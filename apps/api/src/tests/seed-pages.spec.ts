import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { DRAFT_NOTE, hashContent, OLD_PLACEHOLDERS, pagePlan, SEED_PAGES } from '../seed-pages';

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
