import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseSvelteKitData, findNode, unflatten } from './devalue';
import {
  cleanDescription, cleanEmail, cleanPrice, cleanTitle, htmlToText, imageNames, joinLegacyHash, LEGACY_LISTING_ID, LEGACY_SUBCATEGORIES, mapCategory, mapLocation,
  mapOfferType, normalizePhone, sellerName, sourceHash, splitLegacyHash, type LegacyListing,
} from './legacy-map';
import { CATEGORIES, legacyRedirects } from '@dej/shared';

const base: LegacyListing = {
  InzeratId: '810b5a5d-b019-4959-b539-9b0a69d1f844', InzeratName: 'Test', InzeratDescription: '<p>Popis</p>', DateCreated: '2026-11-24T11:00:58.383Z',
  ImgsPath: '["a.webp"]', Price: 100, Location: 'Praha', UserId: 1, CategoryId: 1, SubcategoryId: 113,
};

describe('devalue (data starého webu)', () => {
  it('rozbalí odkazy, data a sdílené hodnoty', () => {
    const v = unflatten([{ list: 1, n: 3 }, [2, 2], { name: 4, when: 5 }, 'x', 'Pes', ['Date', '2026-11-25T14:09:09.586Z']]) as { list: { name: string; when: Date }[] };
    assert.equal(v.list.length, 2);
    assert.equal(v.list[0].name, 'Pes');
    assert.ok(v.list[1].when instanceof Date);
    assert.equal(v.list[1].when.toISOString(), '2026-11-25T14:09:09.586Z');
  });
  it('přežije neplatné indexy a cykly', () => {
    const v = unflatten([{ a: 99, self: 0, u: -1 }]) as Record<string, unknown>;
    assert.equal(v.a, null);
    assert.equal(v.self, v);
    assert.equal(v.u, null);
  });
  it('najde uzel stránky podle klíče', () => {
    const nodes = parseSvelteKitData({ type: 'data', nodes: [{ type: 'data', data: [null] }, null, { type: 'data', data: [{ inzeraty: 1, pageCount: 2 }, [], 15] }] });
    assert.deepEqual(findNode(nodes, 'inzeraty'), []);
    assert.throws(() => parseSvelteKitData({}));
  });
});

describe('převod kategorií', () => {
  const slugs = new Set(CATEGORIES.flatMap((c) => c.children.map((s) => `${c.slug}/${s.slug}`)));
  it('každá stará podkategorie míří na existující novou', () => {
    for (const [id, [p, s]] of Object.entries(LEGACY_SUBCATEGORIES)) assert.ok(slugs.has(`${p}/${s}`), `podkategorie ${id} → ${p}/${s}`);
  });
  it('mapuje podle podkategorie a bez ní podle hlavní kategorie', () => {
    assert.deepEqual(mapCategory({ ...base, CategoryId: 7, SubcategoryId: 76 }), ['zvirata', 'psi']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 1, SubcategoryId: null, InzeratName: 'Opel Meriva' }), ['auto-moto', 'osobni-auta']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 99, SubcategoryId: null }), ['ostatni', 'ruzne']);
  });
  it('upřesní služby, reality a zvířata podle textu', () => {
    assert.deepEqual(mapCategory({ ...base, CategoryId: 8, SubcategoryId: 71, InzeratName: 'Zateplíme vám dům' }), ['sluzby', 'remesla']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 2, SubcategoryId: 4, InzeratName: 'Nabízíme tvorbu moderního prodejního webu' }), ['sluzby', 'it-sluzby']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 3, SubcategoryId: 2, InzeratName: 'Montované garáže s omítkou' }), ['reality', 'garaze']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 3, SubcategoryId: 1, InzeratName: 'Pronájem bytu 2+1 Plzeň' }), ['reality', 'byty-pronajem']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 7, SubcategoryId: null, InzeratName: 'Prodám britská krátkosrstá koťata.' }), ['zvirata', 'kocky']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 7, SubcategoryId: 85, InzeratName: 'Maltézsky psík' }), ['zvirata', 'psi']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 8, SubcategoryId: null, InzeratName: 'Plastové okno 90x90 bílé' }), ['dum-zahrada', 'stavebniny']);
    assert.deepEqual(mapCategory({ ...base, CategoryId: 6, SubcategoryId: 89, InzeratName: 'Pánská zimní bunda' }), ['obleceni', 'panske']);
  });
  it('pozná pronájem a poptávku', () => {
    assert.equal(mapOfferType({ ...base, CategoryId: 3, InzeratName: 'Pronájem skladu' }), 'RENT');
    assert.equal(mapOfferType({ ...base, InzeratName: 'Výkup vozidel' }), 'BUY');
    assert.equal(mapOfferType({ ...base, InzeratName: 'Škoda Fabia' }), 'SELL');
  });
});

describe('texty, cena, místo, kontakt', () => {
  it('převede HTML z editoru na prostý text', () => {
    assert.equal(htmlToText('<p>Ahoj&nbsp;světe</p><p><br></p><p>2,5 mg</p><ul><li>A</li><li>B &amp; C</li></ul>'), 'Ahoj světe\n\n2,5 mg\n\n• A\n• B & C');
    assert.equal(htmlToText('<script>alert(1)</script><b>x</b>&#269;'), 'xč');
  });
  it('zkrátí dlouhý název na celé slovo a doplní krátký popis', () => {
    const t = cleanTitle(`  ${'slovo '.repeat(30)} `);
    assert.ok(t.length <= 90 && !t.endsWith(' '));
    assert.equal(cleanTitle(' Mounjaro  Injekcie '), 'Mounjaro Injekcie');
    assert.match(cleanDescription({ InzeratName: 'Kolo', InzeratDescription: '<p><br></p>' }), /^Kolo\n\n\(Inzerát převzatý/);
    assert.ok(cleanDescription({ InzeratName: 'x', InzeratDescription: 'a'.repeat(9000) }).length <= 8000);
  });
  it('cena 0 a 1 znamená „neuvedeno“', () => {
    assert.equal(cleanPrice(0), null);
    assert.equal(cleanPrice(1), null);
    assert.equal(cleanPrice(3600), 3600);
  });
  it('místo: kraj, Praha, město z textu, prázdné = celá ČR', () => {
    assert.deepEqual(mapLocation('Praha', ''), { city: 'Praha', region: 'PHA', lat: 50.0755, lng: 14.4378 });
    assert.deepEqual(mapLocation('Jihočeský kraj', 'Nic'), { city: 'Jihočeský kraj', region: 'JHC', lat: null, lng: null });
    assert.equal(mapLocation('Jihočeský kraj', 'Penzion České Budějovice').city, 'České Budějovice');
    // město jiného kraje se nepřebírá
    assert.equal(mapLocation('Jihočeský kraj', 'kousek od Brna, Brno').city, 'Jihočeský kraj');
    assert.equal(mapLocation('', 'x').city, 'Celá ČR');
  });
  it('telefon, e-mail a jméno prodejce', () => {
    assert.equal(normalizePhone(' ‪+420 228 880 839'), '+420228880839');
    assert.equal(normalizePhone('721004440'), '+420721004440');
    assert.equal(normalizePhone('00421 905 123 456'), '+421905123456');
    assert.equal(normalizePhone('12345'), null);
    assert.equal(cleanEmail(' Jan.Novak@Seznam.CZ '), 'jan.novak@seznam.cz');
    assert.equal(cleanEmail('neplatny'), null);
    assert.equal(sellerName({ FullName: '', Username: 'vazmoanika' }), 'vazmoanika');
    assert.equal(sellerName({}), 'Prodejce');
  });
  it('ID inzerátu: UUID i staré číselné', () => {
    assert.ok(LEGACY_LISTING_ID.test('810b5a5d-b019-4959-b539-9b0a69d1f844'));
    assert.ok(LEGACY_LISTING_ID.test('14'));
    assert.ok(!LEGACY_LISTING_ID.test('../x'));
  });
  it('fotky: jen bezpečná jména souborů', () => {
    assert.deepEqual(imageNames('["a7d7b2.webp","../etc/passwd","x.jpg",5]'), ['a7d7b2.webp', 'x.jpg']);
    assert.deepEqual(imageNames('nesmysl'), []);
  });
  it('otisk zdroje se změní jen při změně obsahu', () => {
    assert.equal(sourceHash(base), sourceHash({ ...base, DateCreated: '2020-01-01' }));
    assert.notEqual(sourceHash(base), sourceHash({ ...base, Price: 200 }));
    assert.deepEqual(splitLegacyHash(joinLegacyHash('a', 'b')), { source: 'a', written: 'b' });
    assert.deepEqual(splitLegacyHash(null), { source: null, written: null });
  });
  it('přesměrování starých adres nevedou samy na sebe', () => {
    const r = legacyRedirects();
    assert.ok(r.some((x) => x.from === '/kategorie/auto-moto-lode' && x.to === '/kategorie/auto-moto'));
    assert.ok(!r.some((x) => x.from === x.to));
  });
});
