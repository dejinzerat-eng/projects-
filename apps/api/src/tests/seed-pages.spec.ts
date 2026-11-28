import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { DRAFT_NOTE, hashContent, OLD_PLACEHOLDERS, pagePlan, rebrandPage, SEED_PAGES } from '../seed-pages';

const def = (slug: string) => SEED_PAGES.find((p) => p.slug === slug)!;

describe('pagePlan', () => {
  it('vytvoří chybějící stránku', () => {
    assert.equal(pagePlan(null, def('cookies')), 'create');
  });
  it('přepíše původní zástupný text (i s jinými konci řádků)', () => {
    const old = OLD_PLACEHOLDERS.podminky[0].replace(/\n/g, '\r\n');
    assert.equal(pagePlan({ content: old, seededHash: null }, def('podminky')), 'update');
  });
  it('nepřepíše text, který upravil správce', () => {
    assert.equal(pagePlan({ content: 'Naše vlastní podmínky schválené právníkem.', seededHash: null }, def('podminky')), 'skip');
    const seeded = 'Starší návrh ze seedu';
    assert.equal(pagePlan({ content: `${seeded} – upraveno`, seededHash: hashContent(seeded) }, def('podminky')), 'skip');
  });
  it('aktualizuje neupravené znění ze seedu, aktuální přeskočí', () => {
    const seeded = 'Starší návrh ze seedu';
    assert.equal(pagePlan({ content: seeded, seededHash: hashContent(seeded) }, def('podminky')), 'update');
    assert.equal(pagePlan({ content: def('podminky').content, seededHash: hashContent(def('podminky').content) }, def('podminky')), 'skip');
  });
});

describe('SEED_PAGES', () => {
  it('obsahuje všechny právní stránky s popisem', () => {
    for (const slug of ['podminky', 'ochrana-udaju', 'pravidla-inzerovani', 'nahlasovani-obsahu', 'cookies', 'kontakt', 'spotrebitele', 'podminky-placenych-sluzeb']) {
      const p = def(slug);
      assert.ok(p, slug);
      assert.ok(p.description.length >= 50 && p.description.length <= 300, `${slug}: popis`);
    }
  });
  it('právní návrhy jsou označené jako návrh ke kontrole právníkem', () => {
    for (const slug of ['podminky', 'ochrana-udaju', 'pravidla-inzerovani', 'nahlasovani-obsahu', 'cookies', 'spotrebitele', 'podminky-placenych-sluzeb']) assert.ok(def(slug).content.startsWith(DRAFT_NOTE), slug);
    assert.match(DRAFT_NOTE, /Návrh – před spuštěním zkontroluje právník/);
  });
  it('používá jen známé zástupné značky provozovatele', () => {
    const known = new Set(['provozovatel', 'ico', 'sidlo', 'rejstrik', 'email', 'telefon', 'dsa_email', 'web']);
    for (const p of SEED_PAGES) for (const m of p.content.matchAll(/\{\{(\w+)\}\}/g)) assert.ok(known.has(m[1]), `${p.slug}: {{${m[1]}}}`);
    assert.match(def('kontakt').content, /\{\{provozovatel\}\}[\s\S]*\{\{ico\}\}[\s\S]*\{\{sidlo\}\}/);
  });
  it('DSA stránka popisuje náležitosti oznámení a kontaktní místo', () => {
    const c = def('nahlasovani-obsahu').content;
    for (const s of ['dobré víře', 'URL', 'Jednotné kontaktní místo', '{{dsa_email}}', '/nahlasit-obsah']) assert.ok(c.includes(s), s);
  });
});

describe('rebrandPage', () => {
  it('přepíše Dejinzerat.cz na DEJINZERAT.cz, adresy a e-maily nechá', () => {
    const content = 'Portál Dejinzerat.cz – podpora: podpora@dejinzerat.cz, web https://www.dejinzerat.cz';
    const r = rebrandPage({ title: 'O Dejinzerat.cz', content, description: null, seededHash: null })!;
    assert.equal(r.title, 'O DEJINZERAT.cz');
    assert.equal(r.content, 'Portál DEJINZERAT.cz – podpora: podpora@dejinzerat.cz, web https://www.dejinzerat.cz');
    assert.equal(r.description, null);
    assert.equal(r.seededHash, null);
  });
  it('neupravenému znění ze seedu dá nový otisk, upravenému ponechá', () => {
    const content = 'Text Dejinzerat.cz';
    assert.equal(rebrandPage({ title: 'T', content, description: 'x', seededHash: hashContent(content) })!.seededHash, hashContent('Text DEJINZERAT.cz'));
    assert.equal(rebrandPage({ title: 'T', content, description: 'x', seededHash: 'jiny' })!.seededHash, 'jiny');
  });
  it('sjednotí i jiné zápisy, adresy a e-maily nechá', () => {
    const r = rebrandPage({ title: 'DEJinzerat.cz - moderní inzerce', content: 'DEJINZERAT.CZ, DejInzerat.cz, www.Dejinzerat.cz, info@Dejinzerat.cz, https://Dejinzerat.cz/x, dejinzerat.cz', description: '(Dejinzerat.cz)', seededHash: null })!;
    assert.equal(r.title, 'DEJINZERAT.cz - moderní inzerce');
    assert.equal(r.content, 'DEJINZERAT.cz, DEJINZERAT.cz, www.Dejinzerat.cz, info@Dejinzerat.cz, https://Dejinzerat.cz/x, dejinzerat.cz');
    assert.equal(r.description, '(DEJINZERAT.cz)');
  });
  it('je opakovatelné – podruhé už nic nemění', () => {
    assert.equal(rebrandPage({ title: 'DEJINZERAT.cz', content: 'DEJINZERAT.cz', description: 'DEJINZERAT.cz', seededHash: null }), null);
  });
  it('v nových textech seedu starý zápis není', () => {
    for (const p of SEED_PAGES) assert.ok(!/Dejinzerat\.cz/.test(p.title + p.description + p.content), p.slug);
  });
});
