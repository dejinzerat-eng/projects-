import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { assessListing, assessListingDetailed, assessMessage, assessMessageRisk, HIGH_RISK_SCORE, REVIEW_SCORE } from './moderation';

const listing = (title: string, description = 'Popis inzerátu', extra: Partial<Parameters<typeof assessListing>[0]> = {}) =>
  assessListing({ title, description, ...extra });

describe('assessListing', () => {
  it('nechá běžný inzerát bez bodů', () => {
    assert.deepEqual(listing('Silniční kolo Trek Domane, 56 cm'), { score: 0, reasons: [] });
  });

  it('zachytí zakázané zboží', () => {
    for (const title of ['Prodám pistol Glock', 'Revolver po dědovi', 'Marihuana skladem']) {
      const r = listing(title);
      assert.ok(r.score >= 80, title);
      assert.ok(r.reasons.includes('Možný zakázaný obsah'), title);
    }
  });

  it('zachytí i skloňované tvary', () => {
    for (const title of ['Prodám pistoli', 'Kokainu dost', 'Starý revolveru podobný']) assert.ok(listing(title).score >= 80, title);
  });

  it('zachytí slova končící diakritikou (zbraň, extáz)', () => {
    assert.ok(listing('Zbraň na prodej').score >= 80);
    assert.ok(listing('Párty', 'Nabízím extáz').score >= 80);
  });

  it('nezachytí zakázaný kmen uprostřed jiného slova', () => {
    assert.equal(listing('Kniha Bezdrogová výchova', 'Pro rodiče').score, 0);
  });

  it('pozná znaky podvodu', () => {
    const r = listing('iPhone 15', 'Platba přes Western Union, pošlu kurýrem po zaplacení');
    assert.ok(r.reasons.includes('Znaky podvodného inzerátu'));
    assert.ok(r.score >= 50);
  });

  it('boduje mnoho odkazů, velká písmena a opakované znaky', () => {
    assert.ok(listing('Kolo', 'https://a.cz https://b.cz https://c.cz').reasons.includes('Mnoho odkazů'));
    assert.ok(listing('PRODÁM AUTO HNED TEĎ').reasons.includes('Nadpis velkými písmeny'));
    assert.ok(listing('Kolo!!!!!!!!').reasons.includes('Opakované znaky'));
  });

  it('označí podezřele nízkou cenu jen u aut a realit', () => {
    assert.ok(listing('Škoda Octavia', 'x', { price: 50, categorySlug: 'auto-moto' }).reasons.includes('Podezřele nízká cena'));
    assert.equal(listing('Hrnek', 'x', { price: 50, categorySlug: 'dum-zahrada' }).score, 0);
  });

  it('nepřekročí skóre 100', () => {
    const r = listing('PISTOL A MUNICE LEVNĚ!!!!!!!', 'western union https://a https://b https://c', { price: 10, categorySlug: 'auto-moto' });
    assert.equal(r.score, 100);
  });
});

describe('assessMessage', () => {
  it('varuje u podezřelé zprávy', () => {
    assert.match(assessMessage('Pošlete peníze přes Western Union') ?? '', /podvod/);
  });
  it('u běžné zprávy nevaruje', () => {
    assert.equal(assessMessage('Dobrý den, je kolo ještě k mání?'), null);
  });
});

describe('české zakázané zboží (Unicode hranice slov)', () => {
  const prohibited = [
    'Prodám zbraň po dědovi', 'Pistole CZ 75 s pouzdrem', 'Nabízím marihuanu, kvalitní', 'Extáze na párty', 'Řidičák na prodej bez zkoušek',
    'Zařídím řidičák bez autoškoly', 'Prodám občanský průkaz', 'Falešné bankovky 1:1', 'Střelivo ráže 9 mm', 'Kalašnikov AK-47 deko',
    'Pervitin skladem', 'Eskortní služby Praha', 'Erotické masáže s happy end', 'Hašiš a lysohlávky', 'THC vape náplně',
  ];
  for (const t of prohibited) it(`zachytí: ${t}`, () => assert.ok(listing(t).reasons.includes('Možný zakázaný obsah'), t));

  it('vysoce rizikové zboží má skóre pro automatické omezení', () => {
    assert.ok(listing('Prodám zbraň').score >= HIGH_RISK_SCORE);
    assert.ok(listing('Marihuana').score >= HIGH_RISK_SCORE);
  });

  it('padělky a léky jdou jen ke kontrole, ne k omezení účtu', () => {
    for (const t of ['Replika Rolex Submariner', 'Prodám léky na předpis', 'Kabelka 1:1 kopie Louis Vuitton', 'Půjčka bez registru ihned']) {
      const r = listing(t);
      assert.ok(r.score >= REVIEW_SCORE && r.score < HIGH_RISK_SCORE, `${t}: ${r.score}`);
    }
  });

  it('uvádí podrobné štítky pro moderátory', () => {
    assert.deepEqual(assessListingDetailed({ title: 'Pistole Glock', description: 'Popis' }).labels, ['zbraně a střelivo']);
  });

  const benign = [
    'Tavná pistole na lepidlo Bosch', 'Stříkací pistole na barvu', 'Pistole na silikon', 'Vodní pistole pro děti', 'Nerf pistole s náboji',
    'Kniha Pistolník – Stephen King', 'Ford Escort 1.6 combi', 'Drogerie zboží – šampony', 'Přední náboj Shimano Deore', 'Český granát – náušnice',
    'Pistolová vrtačka Makita', 'Pronájem bytu, nutný občanský průkaz při podpisu', 'CBD olej s obsahem THC do 1 %', 'Perník domácí, medový',
    'Tlakový čistič Kärcher s pistolí na mytí', 'Replika historického meče', 'Mikina Adidas originál',
  ];
  for (const t of benign) it(`nezachytí: ${t}`, () => assert.equal(listing(t).score, 0, t));
});

describe('české podvodné vzorce', () => {
  const scams = [
    ['iPhone 15', 'Jsem v zahraničí, pošlu kurýrem po zaplacení.'],
    ['Auto', 'Platba předem na účet v zahraničí.'],
    ['MacBook', 'Preferuji bitcoinem platbu.'],
    ['Byt', 'Napište na WhatsApp +44 7700 900123'],
    ['Kolo', 'Kontakt: telegram +234 803 555 0000'],
    ['Pračka', 'Momentálně jsem na vojenské misi, bratr zařídí dopravu.'],
    ['Kočárek', 'Komunikujte prosím pouze přes WhatsApp.'],
    ['Telefon', 'Zásilkovna vám pošle odkaz pro přijetí platby.'],
    ['Notebook', 'Zaplatím, jen zadejte údaje z karty na odkazu.'],
    ['Štěňata', 'Nutná záloha na dopravu 3000 Kč, pracuji na ropné plošině.'],
    ['Investice', 'Rychlý výdělek, garantovaný výnos 30 % měsíčně.'],
    ['Hodinky', 'Platba přes MoneyGram nebo dárkové karty Google Play.'],
  ];
  for (const [title, d] of scams) it(`zachytí: ${d}`, () => assert.ok(listing(title, d).reasons.includes('Znaky podvodného inzerátu'), d));

  it('česká předvolba ani běžný kontakt nejsou podvod', () => {
    assert.equal(listing('Kolo', 'Volejte nebo pište na WhatsApp +420 777 123 456').score, 0);
    assert.equal(listing('Kolo', 'Platba převodem nebo hotově při převzetí, pošlu i Zásilkovnou.').score, 0);
    assert.equal(listing('Byt', 'Jsem v Brně každý den, prohlídka možná.').score, 0);
  });
});

describe('assessMessageRisk', () => {
  it('pozná podvodnou zprávu', () => {
    const r = assessMessageRisk('Dobrý den, pošlete mi číslo vaší karty a kód z SMS, platbu vám pošlu.');
    assert.equal(r.scam, true);
    assert.ok(r.score >= REVIEW_SCORE);
    assert.ok(r.labels.includes('platební odkaz nebo údaje z karty'));
  });
  it('vysoké riziko u nabídky drog ve zprávě', () => {
    assert.ok(assessMessageRisk('Mám i kokain, napiš').score >= HIGH_RISK_SCORE);
  });
  it('běžná zpráva je bez rizika', () => {
    assert.deepEqual(assessMessageRisk('Dobrý den, je kolo ještě k mání? Můžu se zastavit zítra.'), { score: 0, scam: false, labels: [] });
  });
  it('varování příjemci u zprávy z ciziny', () => {
    assert.match(assessMessage('Jsem v zahraničí, kurýr si vyzvedne zboží a peníze vám pošle.') ?? '', /podvod/);
  });
});

