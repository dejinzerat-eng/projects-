import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORIES, effectiveFilters } from '@dej/shared';
import { fieldKey, itemHash, mapItem, normalizeAttrs, parseCondition, parseNumber, parseOffer, parsePrice, suggestCategory, suggestFieldMap, type CatRef } from './feed-map';
import { decodeXml, parseFeed } from './feed-parse';
import { isPrivateAddress } from './feed-source';

const HEUREKA = `<?xml version="1.0" encoding="utf-8"?>
<SHOP>
  <SHOPITEM>
    <ITEM_ID>A-1</ITEM_ID>
    <PRODUCTNAME>Apple iPhone 13 128GB modrý</PRODUCTNAME>
    <DESCRIPTION><![CDATA[<p>Zánovní telefon,&nbsp;baterie 92 %.</p><ul><li>nabíječka</li></ul>]]></DESCRIPTION>
    <URL>https://eshop.example.cz/iphone-13</URL>
    <IMGURL>https://eshop.example.cz/img/1.jpg</IMGURL>
    <IMGURL_ALTERNATIVE>https://eshop.example.cz/img/2.jpg</IMGURL_ALTERNATIVE>
    <IMGURL_ALTERNATIVE>https://eshop.example.cz/img/3.jpg</IMGURL_ALTERNATIVE>
    <PRICE_VAT>12 990,00</PRICE_VAT>
    <MANUFACTURER>Apple</MANUFACTURER>
    <CATEGORYTEXT>Elektronika | Mobilní telefony</CATEGORYTEXT>
    <ITEM_TYPE>bazaar</ITEM_TYPE>
    <PARAM><PARAM_NAME>Barva</PARAM_NAME><VAL>modrá</VAL></PARAM>
  </SHOPITEM>
  <SHOPITEM>
    <ITEM_ID>A-2</ITEM_ID>
    <PRODUCTNAME>Samsung Galaxy Watch 6</PRODUCTNAME>
    <DESCRIPTION>Nové, nerozbalené.</DESCRIPTION>
    <PRICE_VAT>4990</PRICE_VAT>
    <CATEGORYTEXT>Elektronika &gt; Chytré hodinky</CATEGORYTEXT>
  </SHOPITEM>
</SHOP>`;

const GOOGLE = `<?xml version="1.0"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>Shop</title>
  <item><g:id>G1</g:id><g:title>Dětský kočárek Cybex</g:title><g:description>Málo používaný.</g:description><g:link>https://shop.example.cz/k</g:link>
  <g:image_link>https://shop.example.cz/k.jpg</g:image_link><g:price>7 500.00 CZK</g:price><g:condition>used</g:condition><g:product_type>Děti &gt; Kočárky</g:product_type></item>
</channel></rss>`;

const CARS = `<?xml version="1.0" encoding="windows-1250"?>
<export><vozidla>
  <vozidlo id="771">
    <znacka>Škoda</znacka><model>Octavia Combi 2.0 TDI</model><rok_vyroby>05/2018</rok_vyroby><najeto>125 000 km</najeto>
    <palivo>diesel</palivo><prevodovka>automatická (DSG)</prevodovka><karoserie>kombi</karoserie><vykon>110 kW</vykon>
    <cena>289000</cena><popis>Servisní knížka, 1. majitel.</popis><mesto>Brno</mesto>
    <fotky><foto url="https://bazar.example.cz/771/1.jpg"/><foto url="https://bazar.example.cz/771/2.jpg"/></fotky>
  </vozidlo>
  <vozidlo id="772">
    <znacka>VW</znacka><model>Golf</model><rok_vyroby>2015</rok_vyroby><najeto>180000</najeto><palivo>benzín</palivo><cena>189 000 Kč</cena><mesto>Brno</mesto>
  </vozidlo>
</vozidla></export>`;

const REALITY = `<inzeraty>
  <inzerat><id>R1</id><nazev>Pronájem bytu 2+kk, 54 m², Praha 5</nazev><popis>Světlý byt po rekonstrukci.</popis><cena>21000</cena>
  <typ_nabidky>pronájem</typ_nabidky><kategorie>Byty</kategorie><parametr nazev="Dispozice">2+kk</parametr><parametr nazev="Užitná plocha">54 m2</parametr>
  <parametr nazev="Vlastnictví">osobní</parametr><parametr nazev="PENB">C</parametr><mesto>Praha</mesto><psc>150 00</psc></inzerat>
</inzeraty>`;

const cats: CatRef[] = CATEGORIES.flatMap((p) => p.children.map((c) => ({ id: `${p.slug}/${c.slug}`, slug: c.slug, name: c.name, parentSlug: p.slug, parentName: p.name })));
/** Kategorie podle zobrazených názvů (adresy kategorií se mohou změnit, názvy ne). */
const named = (c: CatRef | null) => (c ? `${c.parentName} › ${c.name}` : null);
const filtersOf = (id: string) => { const [p, c] = id.split('/'); const parent = CATEGORIES.find((x) => x.slug === p)!; return effectiveFilters(p, parent.filters, c, parent.children.find((x) => x.slug === c)!.filters ?? []); };

describe('čtení XML feedu', () => {
  it('Heureka: položky, PARAM, CDATA a entity', () => {
    const f = parseFeed(HEUREKA);
    assert.equal(f.format, 'heureka');
    assert.equal(f.items.length, 2);
    assert.deepEqual(f.items[0]['param:Barva'], ['modrá']);
    assert.deepEqual(f.items[0].IMGURL_ALTERNATIVE, ['https://eshop.example.cz/img/2.jpg', 'https://eshop.example.cz/img/3.jpg']);
    assert.equal(f.items[1].CATEGORYTEXT[0], 'Elektronika > Chytré hodinky');
  });
  it('Google Merchant (RSS s g:)', () => {
    const f = parseFeed(GOOGLE);
    assert.equal(f.format, 'google');
    assert.equal(f.items.length, 1);
    assert.equal(f.items[0]['g:id'][0], 'G1');
  });
  it('obecné XML v kódování windows-1250, atributy a vnořené fotky', () => {
    const buf = Buffer.from(new Uint8Array([...CARS].map((ch) => ({ Š: 0x8a, í: 0xed, á: 0xe1, č: 0xe8 } as Record<string, number>)[ch] ?? ch.charCodeAt(0))));
    const f = parseFeed(decodeXml(buf));
    assert.equal(f.format, 'generic');
    assert.equal(f.itemTag, 'vozidlo');
    assert.equal(f.items[0].znacka[0], 'Škoda');
    assert.equal(f.items[0]['@id'][0], '771');
    assert.deepEqual(f.items[0]['fotky/foto/@url'], ['https://bazar.example.cz/771/1.jpg', 'https://bazar.example.cz/771/2.jpg']);
  });
  it('jedna položka a parametry s atributem názvu', () => {
    const f = parseFeed(REALITY);
    assert.equal(f.items.length, 1);
    assert.equal(f.items[0]['param:Dispozice'][0], '2+kk');
  });
  it('vlastní entity v DOCTYPE se nerozbalí, nesmysl ohlásí srozumitelně', () => {
    const f = parseFeed('<!DOCTYPE x [<!ENTITY a "AAAA"><!ENTITY b "&a;&a;&a;">]><list><item><id>1</id><nazev>Test &b;</nazev></item><item><id>2</id><nazev>X</nazev></item></list>');
    assert.ok(!f.items[0].nazev[0].includes('AAAA'));
    assert.throws(() => parseFeed('<html'), /XML/);
    assert.throws(() => parseFeed('{"json": true}'), /XML/);
    assert.throws(() => parseFeed('<a><b>1</b></a>'), /nenašli/);
  });
  it('limit počtu položek', () => {
    const f = parseFeed(`<l>${Array.from({ length: 30 }, (_, i) => `<item><id>${i}</id></item>`).join('')}</l>`, 10);
    assert.equal(f.items.length, 10);
    assert.equal(f.total, 30);
  });
});

describe('přiřazení polí a převod položky', () => {
  it('Heureka předvolba', () => {
    const f = parseFeed(HEUREKA);
    const map = suggestFieldMap('heureka', f.fields);
    assert.deepEqual(map.images, ['IMGURL', 'IMGURL_ALTERNATIVE']);
    const { item } = mapItem(f.items[0], map);
    assert.ok(item);
    assert.equal(item.id, 'A-1');
    assert.equal(item.price, 12990);
    assert.equal(item.description, 'Zánovní telefon, baterie 92 %.\n\n• nabíječka');
    assert.equal(item.images.length, 3);
    assert.equal(item.condition, 'USED');
    assert.equal(item.url, 'https://eshop.example.cz/iphone-13');
  });
  it('autobazar: odhad polí podle názvů, název ze značky a modelu, parametry', () => {
    const f = parseFeed(CARS);
    const map = suggestFieldMap('generic', f.fields);
    assert.deepEqual(map.id, ['@id']);
    assert.deepEqual(map.images, ['fotky/foto/@url']);
    assert.deepEqual(map.brand, ['znacka']);
    assert.deepEqual(map.mileage, ['najeto']);
    const { item } = mapItem(f.items[0], map);
    assert.ok(item);
    assert.equal(item.id, '771');
    assert.equal(item.title, 'Škoda Octavia Combi 2.0 TDI');
    assert.equal(item.price, 289000);
    assert.equal(item.city, 'Brno');
    const cat = suggestCategory(item.category, cats, { attrs: item.attrs })!;
    assert.equal(named(cat), 'Auto-moto › Osobní automobily');
    assert.deepEqual(normalizeAttrs(item, filtersOf(cat.id)), { brand: 'Škoda', year: 2018, mileage: 125000, fuel: 'Nafta', gearbox: 'Automatická', body: 'Kombi', power: 110 });
    const vw = mapItem(f.items[1], map).item!;
    assert.equal(normalizeAttrs(vw, filtersOf(cat.id)).brand, 'Volkswagen');
    assert.equal(vw.price, 189000);
  });
  it('reality: pronájem, dispozice, plocha, PSČ, kategorie byty k pronájmu', () => {
    const f = parseFeed(REALITY);
    const map = suggestFieldMap('generic', f.fields);
    const { item } = mapItem(f.items[0], map);
    assert.ok(item);
    assert.equal(item.offer, 'RENT');
    assert.equal(item.zip, '15000');
    const cat = suggestCategory(item.category, cats, { offer: item.offer, attrs: item.attrs })!;
    assert.equal(named(cat), 'Reality › Byty k pronájmu');
    assert.deepEqual(normalizeAttrs(item, filtersOf(cat.id)), { offerType: 'Pronájem', layout: '2+kk', area: 54, ownership: 'Osobní', energy: 'C' });
  });
  it('ruční přiřazení má přednost, prázdné = nepoužít', () => {
    const f = parseFeed(HEUREKA);
    const map = suggestFieldMap('heureka', f.fields, { title: ['DESCRIPTION'], brand: [] });
    assert.deepEqual(map.title, ['DESCRIPTION']);
    assert.deepEqual(map.brand, []);
  });
  it('položka bez názvu je chyba, bez ID dostane stabilní ID podle odkazu', () => {
    assert.equal(mapItem({ cena: ['100'] }, { price: ['cena'] }).error, 'Chybí název nabídky.');
    const a = mapItem({ t: ['Stůl dubový'], u: ['https://x.cz/stul'] }, { title: ['t'], url: ['u'] }).item!;
    const b = mapItem({ t: ['Stůl dubový – sleva'], u: ['https://x.cz/stul'] }, { title: ['t'], url: ['u'] }).item!;
    assert.equal(a.id, b.id);
    assert.notEqual(itemHash(a), itemHash(b));
  });
  it('relativní a nebezpečné odkazy na fotky', () => {
    const { item } = mapItem({ t: ['Křeslo'], img: ['/foto/1.jpg', 'javascript:alert(1)', 'https://u:p@x.cz/a.jpg', 'https://x.cz/a.jpg https://x.cz/b.jpg'] }, { title: ['t'], images: ['img'] }, 'https://partner.cz/feed.xml');
    assert.deepEqual(item!.images, ['https://partner.cz/foto/1.jpg', 'https://x.cz/a.jpg', 'https://x.cz/b.jpg']);
  });
  it('Google: cena s měnou a kategorie', () => {
    const f = parseFeed(GOOGLE);
    const { item } = mapItem(f.items[0], suggestFieldMap('google', f.fields));
    assert.equal(item!.price, 7500);
    assert.equal(item!.currency, 'CZK');
    assert.equal(item!.condition, 'USED');
    assert.equal(named(suggestCategory(item!.category, cats)), 'Děti a kojenecké potřeby › Kočárky');
  });
});

describe('hodnoty', () => {
  it('čísla a ceny', () => {
    assert.equal(parseNumber('289 000 Kč'), 289000);
    assert.equal(parseNumber('125.000 km'), 125000);
    assert.equal(parseNumber('1 234,50'), 1234.5);
    assert.equal(parseNumber('1,6'), 1.6);
    assert.ok(Number.isNaN(parseNumber('dohodou')));
    assert.deepEqual(parsePrice('99,90 EUR'), { price: 100, currency: 'EUR' });
    assert.deepEqual(parsePrice('0'), { price: null, currency: 'CZK' });
    assert.deepEqual(parsePrice('Info v RK'), { price: null, currency: 'CZK' });
  });
  it('stav a typ nabídky', () => {
    assert.equal(parseCondition('new'), 'NEW');
    assert.equal(parseCondition('Nové'), 'NEW');
    assert.equal(parseCondition('refurbished'), 'LIKE_NEW');
    assert.equal(parseCondition('ojeté'), 'USED');
    assert.equal(parseCondition('havarované'), 'DAMAGED');
    assert.equal(parseCondition(''), null);
    assert.equal(parseOffer('Prodej'), 'SELL');
    assert.equal(parseOffer('nájem'), 'RENT');
    assert.equal(parseOffer(undefined, 'Pronájem bytu 2+1'), 'RENT');
  });
  it('klíč pole', () => {
    assert.equal(fieldKey('param:Rok výroby'), 'rokvyroby');
    assert.equal(fieldKey('g:image_link'), 'imagelink');
    assert.equal(fieldKey('fotky/foto/@url'), 'url');
  });
  it('kategorie e-shopu podle názvu podkategorie', () => {
    assert.equal(named(suggestCategory('Elektronika | Mobilní telefony', cats)), 'Mobily a příslušenství › Mobilní telefony');
    assert.equal(named(suggestCategory('Elektronika > Chytré hodinky', cats)), 'Mobily a příslušenství › Chytré hodinky');
    assert.equal(named(suggestCategory('Motocykly', cats)), 'Auto-moto › Motocykly a skútry');
    assert.equal(named(suggestCategory('Prodej rodinného domu', cats)), 'Reality › Domy');
    assert.equal(named(suggestCategory('Garáže', cats)), 'Reality › Garáže');
    assert.equal(suggestCategory('', cats), null);
  });
});

describe('bezpečnost stahování', () => {
  it('soukromé adresy', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.10', '172.20.1.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:127.0.0.1', '0.0.0.0', '100.64.0.1']) assert.equal(isPrivateAddress(ip), true, ip);
    for (const ip of ['77.75.77.222', '2a02:598:2::1', '8.8.8.8']) assert.equal(isPrivateAddress(ip), false, ip);
  });
});
