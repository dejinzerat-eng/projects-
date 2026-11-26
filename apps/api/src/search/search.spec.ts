import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { buildSearchText, fromSearchString, haversine, normalizeSearchText, queryWords, stemCz, synonymsOf, toSearchString } from '@dej/shared';
import { findMunicipality, municipalityByZip, nearestMunicipality, resolveLocation, suggestMunicipalities } from '@dej/shared/dist/municipalities';
import { boundingBox, buildTerms, categoriesFor, filterSql, orderSql, promotionExpired, rankAt, termsFuzzy, termsMatch, tierSql } from './search-query';

const sqlText = (s: Prisma.Sql) => s.sql;

describe('normalizace textu pro hledání', () => {
  it('odstraní diakritiku, velká písmena a interpunkci', () => {
    assert.equal(normalizeSearchText('Kočárek – ŠKODA 1.6, Łódź!'), 'kocarek skoda 1 6 lodz');
    assert.equal(normalizeSearchText('Ťuhýk Ůžasný Ěščřžýáíé'), 'tuhyk uzasny escrzyaie');
  });

  it('searchText obsahuje název, popis, parametry a město', () => {
    const t = buildSearchText({ title: 'Škoda Octavia', description: 'Servisní knížka', attributes: { brand: 'Škoda', year: 2018, abs: true, extras: ['Tažné', 'Klima'] }, city: 'Plzeň' });
    assert.equal(t, 'skoda octavia servisni knizka skoda 2018 tazne klima plzen');
  });

  it('slova dotazu bez duplicit', () => {
    assert.deepEqual(queryWords('  iPhone  IPHONE 15 '), ['iphone', '15']);
  });

  it('zkracuje české koncovky jen u delších slov', () => {
    assert.equal(stemCz('kocarky'), 'kocar');
    assert.equal(stemCz('kolo'), 'kolo');
    assert.equal(stemCz('ps5'), 'ps5');
  });
});

describe('synonyma', () => {
  it('fungují bez diakritiky a obousměrně', () => {
    assert.ok(synonymsOf('gauc').includes('pohovka'));
    assert.ok(synonymsOf('Sedačka').includes('gauc'));
    assert.ok(synonymsOf('notebook').includes('laptop'));
    assert.ok(synonymsOf('laptop').includes('notebook'));
    assert.deepEqual(synonymsOf('xyzabc'), ['xyzabc']);
  });

  it('fráze se rozpozná jako jeden výraz', () => {
    const terms = buildTerms('horské kolo');
    assert.equal(terms.length, 1);
    assert.equal(terms[0].word, 'horske kolo');
    assert.ok(terms[0].alts.some((a) => a.length === 1 && a[0] === 'mtb'));
    // obě slova kdekoli v textu
    assert.ok(terms[0].alts.some((a) => a.length === 2));
  });

  it('slovo dostane synonyma i zkrácený tvar, předložky se vynechají', () => {
    const terms = buildTerms('kočárky v Brně');
    assert.deepEqual(terms.map((t) => t.word), ['kocarky', 'brne']);
    // dotaz jen z předložek se nezahodí celý
    assert.equal(buildTerms('a v').length, 2);
    const alts = terms[0].alts.map((a) => a[0]);
    assert.ok(alts.includes('kocar'));
    // „kocarky“ je zbytečné vedle kratšího „kocar“
    assert.ok(!alts.includes('kocarky'));
  });
});

describe('SQL pro vyhledávání v PostgreSQL', () => {
  const base = { attrKeys: ['brand', 'year'], now: new Date('2026-11-25T12:00:00Z') };

  it('okruh je kruh (haversine) s obdélníkem pro index a omezený na 500 km', () => {
    const where = filterSql({ radius: 900 }, { ...base, geo: { lat: 50, lng: 14 } }).map(sqlText).join(' AND ');
    assert.match(where, /asin/);
    assert.match(where, /BETWEEN/);
    const b = boundingBox({ lat: 50, lng: 14 }, 500);
    const values = filterSql({ radius: 900 }, { ...base, geo: { lat: 50, lng: 14 } }).flatMap((s) => s.values);
    assert.ok(values.includes(500));
    assert.ok(Math.abs(b.maxLat - 50 - 500 / 111.32) < 1e-9);
  });

  it('filtr data i řazení podle data používají publishedAt', () => {
    const where = filterSql({ since: '7d' }, base).map(sqlText).join(' ');
    assert.match(where, /"publishedAt" >/);
    assert.doesNotMatch(where, /createdAt/);
    assert.match(sqlText(orderSql('newest', base)), /^l\."publishedAt" DESC NULLS LAST/);
  });

  it('nejdražší dávají ceny „dohodou“ na konec', () => {
    assert.match(sqlText(orderSql('price_desc', base)), /"priceCzk" DESC NULLS LAST/);
    assert.match(sqlText(orderSql('price_asc', base)), /"priceCzk" ASC NULLS LAST/);
  });

  it('cena se řadí i filtruje v Kč (eura přepočtená), ne podle částky v původní měně', () => {
    assert.doesNotMatch(sqlText(orderSql('price_asc', base)), /"price" /);
    const w = filterSql({ priceMin: 100, priceMax: 5000 }, base).map(sqlText).join(' ');
    assert.match(w, /"priceCzk" >= /);
    assert.match(w, /"priceCzk" <= /);
    assert.doesNotMatch(w, /"price" /);
  });

  it('relevance: kvalita shody → platné topování → datum', () => {
    const quality = Prisma.sql`quality`;
    const o = sqlText(orderSql(undefined, { ...base, quality }));
    assert.ok(o.indexOf('quality') < o.indexOf('topUntil'));
    assert.ok(o.indexOf('topUntil') < o.indexOf('COALESCE'));
    // topování se porovnává s aktuálním časem (vypršelé se nepočítá)
    assert.match(o, /"topUntil" > /);
  });

  it('„Nejblíže“ řadí podle vzdálenosti, bez polohy podle relevance', () => {
    assert.match(sqlText(orderSql('distance', { ...base, geo: { lat: 50, lng: 14 } })), /asin/);
    assert.doesNotMatch(sqlText(orderSql('distance', base)), /asin/);
  });

  it('typ prodejce a ověření', () => {
    assert.match(filterSql({ sellerType: 'business' }, base).map(sqlText).join(' '), /"isBusiness" = true AND u."companyVerifiedAt" IS NOT NULL/);
    assert.match(filterSql({ sellerType: 'private' }, base).map(sqlText).join(' '), /"isBusiness" = false/);
  });

  it('neznámé parametry se ignorují', () => {
    const w = filterSql({ attrs: { 'x; DROP TABLE': 'a', brand: 'Škoda' } }, base);
    assert.equal(w.length, 2);
    assert.ok(w[1].values.includes('Škoda'));
  });

  it('slovo najde i inzeráty z podkategorie stejného jména', () => {
    assert.deepEqual(buildTerms('notebook')[0].cats, ['notebooky']);
    assert.ok(buildTerms('laptop')[0].cats.includes('notebooky'));
    assert.ok(buildTerms('mobil')[0].cats.includes('mobilni-telefony'));
    // krátká slova a předložky kategorie neberou
    assert.deepEqual(categoriesFor([['a']]), []);
    assert.deepEqual(categoriesFor([['tv']]), []);
    const sql = termsMatch(Prisma.sql`t`, buildTerms('notebook'), true);
    assert.match(sqlText(sql), /c\."slug" IN/);
    assert.doesNotMatch(sqlText(termsMatch(Prisma.sql`t`, buildTerms('notebook'))), /slug/);
    // shoda jen v názvu kategorie má nejnižší kvalitu
    assert.match(sqlText(tierSql(buildTerms('notebook'), 'notebook')), /THEN 0/);
  });

  it('obec v okruhu: podle názvu jen inzeráty bez souřadnic, stejná jména rozliší kraj', () => {
    const inRadius = filterSql({ radius: 20 }, { ...base, geo: { lat: 49.3, lng: 16.6 }, cityKey: 'adamov', cityRegion: 'JHM' }).map(sqlText).join(' ');
    assert.match(inRadius, /"lat" IS NULL AND/);
    const only = filterSql({}, { ...base, geo: { lat: 49.3, lng: 16.6 }, cityKey: 'adamov', cityRegion: 'JHM' });
    assert.match(only.map(sqlText).join(' '), /"region" IN/);
    assert.ok(only.flatMap((x) => x.values).includes('JHM'));
  });

  it('oprava překlepů jen pro slova od 4 znaků', () => {
    assert.equal(termsFuzzy(Prisma.sql`t`, buildTerms('tv')), undefined);
    assert.match(sqlText(termsFuzzy(Prisma.sql`t`, buildTerms('iphoen 15'))!), /<%/);
  });
});

describe('obce ČR', () => {
  it('najde obec bez diakritiky i s okresem', () => {
    assert.equal(findMunicipality('plzen')?.name, 'Plzeň');
    assert.equal(findMunicipality('USTI NAD LABEM')?.region, 'ULK');
    assert.equal(findMunicipality('Adamov (okres Blansko)')?.district, 'Blansko');
    assert.equal(findMunicipality('Kutná Hora')?.region, 'STC');
  });

  it('rozliší stejné názvy podle PSČ a rozumí částem obce', () => {
    assert.equal(findMunicipality('Říčany', '251 01')?.district, 'Praha-východ');
    assert.equal(findMunicipality('Říčany', '66482')?.district, 'Brno-venkov');
    assert.equal(findMunicipality('Praha 4')?.name, 'Praha');
    assert.equal(findMunicipality('Brno-Líšeň')?.name, 'Brno');
  });

  it('PSČ: přesná shoda, pražská PSČ, jinak nejbližší ve stejné oblasti', () => {
    assert.equal(municipalityByZip('60200')?.name, 'Brno');
    assert.equal(municipalityByZip('14800')?.name, 'Praha');
    assert.equal(municipalityByZip('abc'), undefined);
  });

  it('lokalita inzerátu: PSČ uživatele má přednost, neznámá obec bez souřadnic', () => {
    assert.deepEqual(resolveLocation('brno', ''), { city: 'Brno', region: 'JHM', zip: '60200', lat: 49.1952, lng: 16.6069, matched: 'name' });
    assert.equal(resolveLocation('Brno', '62500').zip, '62500');
    const unknown = resolveLocation('Neexistujícíves', '');
    assert.deepEqual([unknown.region, unknown.lat, unknown.matched], ['', null, 'none']);
    const byZip = resolveLocation('Chodov u Prahy', '14800');
    assert.deepEqual([byZip.city, byZip.region, byZip.matched], ['Chodov u Prahy', 'PHA', 'zip']);
    // stejné jméno obce jinde v republice – rozhodne PSČ
    assert.equal(resolveLocation('Chodov', '148 00').region, 'PHA');
    assert.equal(resolveLocation('Chodov', '357 35').region, 'KVK');
    // vybrané okresní město se nepřepíše starým PSČ odjinud
    assert.equal(resolveLocation('Brno', '32600').region, 'JHM');
    assert.equal(resolveLocation('Brno', '32600').zip, '32600');
  });

  it('našeptávač podle začátku názvu, slova i PSČ', () => {
    assert.equal(suggestMunicipalities('kutna')[0].name, 'Kutná Hora');
    assert.ok(suggestMunicipalities('labem').some((m) => m.name === 'Ústí nad Labem'));
    assert.equal(suggestMunicipalities('602')[0].name, 'Brno');
    assert.equal(suggestMunicipalities('148')[0]?.name, 'Praha');
    assert.ok(suggestMunicipalities('adamov').every((m) => m.label.includes('okres')));
  });

  it('nejbližší obec a vzdálenost', () => {
    assert.equal(nearestMunicipality(49.1951, 16.6068)?.name, 'Brno');
    assert.ok(Math.abs(haversine({ lat: 50.0755, lng: 14.4378 }, { lat: 49.1951, lng: 16.6068 }) - 185) < 5);
  });
});

describe('parametry v URL', () => {
  it('typ prodejce a poloha', () => {
    const p = fromSearchString(new URLSearchParams('prodejce=firma&lat=50.1&lng=14.4&okruh=30'));
    assert.equal(p.sellerType, 'business');
    assert.deepEqual([p.lat, p.lng, p.radius], [50.1, 14.4, 30]);
    assert.match(toSearchString({ sellerType: 'private', lat: 50.1, lng: 14.4 }), /prodejce=soukromy/);
    assert.equal(fromSearchString(new URLSearchParams('lat=500&lng=14')).lat, undefined);
    assert.equal(fromSearchString(new URLSearchParams('prodejce=xyz')).sellerType, undefined);
  });
});

describe('konec propagace', () => {
  const now = new Date('2026-11-26T12:00:00Z');
  const past = new Date('2026-11-25T12:00:00Z');
  const future = new Date('2026-11-30T12:00:00Z');

  it('vymaže jen prošlé topování / zvýraznění', () => {
    assert.deepEqual(promotionExpired({ topUntil: past, highlightedUntil: future }, now), { topUntil: null });
    assert.deepEqual(promotionExpired({ topUntil: future, highlightedUntil: past }, now), { highlightedUntil: null });
    assert.deepEqual(promotionExpired({ topUntil: past, highlightedUntil: past }, now), { topUntil: null, highlightedUntil: null });
    assert.deepEqual(promotionExpired({ topUntil: null, highlightedUntil: future }, now), {});
  });

  it('prošlé topování už v Meilisearch neřadí inzerát před novější', () => {
    const base = { bumpedAt: null, createdAt: past };
    const oldTop = rankAt({ ...base, topUntil: past, publishedAt: new Date('2026-11-01T00:00:00Z') }, now.getTime());
    const fresh = rankAt({ ...base, topUntil: null, publishedAt: new Date('2026-11-20T00:00:00Z') }, now.getTime());
    const activeTop = rankAt({ ...base, topUntil: future, publishedAt: new Date('2026-11-01T00:00:00Z') }, now.getTime());
    assert.ok(fresh > oldTop);
    assert.ok(activeTop > fresh);
  });
});
