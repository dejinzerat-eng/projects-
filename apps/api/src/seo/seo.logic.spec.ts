import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { categoryRedirects, isGone, normalizePath, PageMetaDto, redirectCandidates, RedirectDto } from './seo.logic';

const now = new Date('2026-06-01T12:00:00Z');
const days = (n: number) => new Date(now.getTime() - n * 864e5);

describe('isGone', () => {
  it('smazané a zamítnuté inzeráty jsou pryč', () => {
    assert.equal(isGone({ status: 'DELETED', expiresAt: null, updatedAt: now }, now), true);
    assert.equal(isGone({ status: 'REJECTED', expiresAt: null, updatedAt: now }, now), true);
  });
  it('vypršelé až po 30 dnech, prodané po 60 dnech', () => {
    assert.equal(isGone({ status: 'EXPIRED', expiresAt: days(10), updatedAt: now }, now), false);
    assert.equal(isGone({ status: 'EXPIRED', expiresAt: days(31), updatedAt: now }, now), true);
    assert.equal(isGone({ status: 'SOLD', expiresAt: null, updatedAt: days(20) }, now), false);
    assert.equal(isGone({ status: 'SOLD', expiresAt: null, updatedAt: days(61) }, now), true);
  });
  it('aktivní, rezervované a čekající nejsou pryč', () => {
    for (const status of ['ACTIVE', 'RESERVED', 'PENDING', 'DRAFT']) assert.equal(isGone({ status, expiresAt: days(100), updatedAt: days(100) }, now), false);
  });
});

describe('normalizePath', () => {
  it('odstraní doménu, dotaz, lomítka a sjednotí velikost písmen', () => {
    assert.equal(normalizePath('https://dejinzerat.cz/Kategorie/Auto/?strana=2#x'), '/kategorie/auto');
    assert.equal(normalizePath('kategorie//elektronika/'), '/kategorie/elektronika');
    assert.equal(normalizePath('/'), '/');
    assert.equal(normalizePath('  '), null);
    assert.equal(normalizePath('/stary-bazar/%C5%A1koda'), '/stary-bazar/škoda');
  });
});

describe('RedirectDto', () => {
  it('normalizuje zdroj a výchozí kód je 308', () => {
    const r = RedirectDto.parse({ from: 'https://dejinzerat.cz/kategorie/stara/', to: '/kategorie/nova' });
    assert.deepEqual(r, { from: '/kategorie/stara', to: '/kategorie/nova', code: 308 });
  });
  it('odmítne smyčku, úvodní stránku, /api a cizí http cíl', () => {
    assert.equal(RedirectDto.safeParse({ from: '/a', to: '/a/' }).success, false);
    assert.equal(RedirectDto.safeParse({ from: '/', to: '/b' }).success, false);
    assert.equal(RedirectDto.safeParse({ from: '/api/x', to: '/b' }).success, false);
    assert.equal(RedirectDto.safeParse({ from: '/a', to: 'http://evil.example' }).success, false);
    assert.equal(RedirectDto.safeParse({ from: '/a', to: 'https://partner.cz/x', code: 302 }).success, true);
  });
  it('odmítne adresy, které prohlížeč vezme jako jinou doménu (//host, /\\host)', () => {
    assert.equal(RedirectDto.safeParse({ from: '/a', to: '//evil.example/x' }).success, false);
    assert.equal(RedirectDto.safeParse({ from: '/a', to: '/\\evil.example' }).success, false);
    assert.equal(RedirectDto.safeParse({ from: '/a', to: 'https:///evil' }).success, false);
  });
});

describe('PageMetaDto', () => {
  it('přijme datum RRRR-MM-DD nebo prázdnou hodnotu', () => {
    assert.equal(PageMetaDto.safeParse({ effectiveFrom: '2026-12-01', reviewedAt: '' }).success, true);
    assert.equal(PageMetaDto.safeParse({ effectiveFrom: '1. 12. 2026' }).success, false);
  });
});

describe('přesměrování kategorií', () => {
  it('změna adresy hlavní kategorie přesměruje i podkategorie', () => {
    assert.deepEqual(categoryRedirects({ slug: 'auta', parentSlug: null }, { slug: 'auto-moto', parentSlug: null }, ['osobni', 'nahradni-dily']), [
      { from: '/kategorie/auta', to: '/kategorie/auto-moto' },
      { from: '/kategorie/auta/osobni', to: '/kategorie/auto-moto/osobni' },
      { from: '/kategorie/auta/nahradni-dily', to: '/kategorie/auto-moto/nahradni-dily' },
    ]);
  });
  it('podkategorie: nová adresa i přesun pod jinou hlavní kategorii', () => {
    assert.deepEqual(categoryRedirects({ slug: 'kola', parentSlug: 'sport' }, { slug: 'jizdni-kola', parentSlug: 'sport' }), [{ from: '/kategorie/sport/kola', to: '/kategorie/sport/jizdni-kola' }]);
    assert.deepEqual(categoryRedirects({ slug: 'kola', parentSlug: 'sport' }, { slug: 'kola', parentSlug: 'doprava' }), [{ from: '/kategorie/sport/kola', to: '/kategorie/doprava/kola' }]);
    assert.deepEqual(categoryRedirects({ slug: 'kola', parentSlug: null }, { slug: 'kola', parentSlug: 'sport' }), [{ from: '/kategorie/kola', to: '/kategorie/sport/kola' }]);
  });
  it('beze změny adresy žádné přesměrování', () => {
    assert.deepEqual(categoryRedirects({ slug: 'auta', parentSlug: null }, { slug: 'auta', parentSlug: null }, ['osobni']), []);
  });
  it('kandidáti: přesná adresa, u kategorií i kratší začátky', () => {
    assert.deepEqual(redirectCandidates('/stranka/stara'), [{ prefix: '/stranka/stara', rest: '' }]);
    assert.deepEqual(redirectCandidates('/kategorie/auta/osobni/mesto/praha').map((c) => `${c.prefix}|${c.rest}`), [
      '/kategorie/auta/osobni/mesto/praha|', '/kategorie/auta/osobni/mesto|/praha', '/kategorie/auta/osobni|/mesto/praha', '/kategorie/auta|/osobni/mesto/praha',
    ]);
    // Dlouhá adresa: hledají se jen začátky do délky výpisu kategorie s lokalitou
    const long = redirectCandidates(`/kategorie/a${'/x'.repeat(200)}`);
    assert.equal(long.length, 4);
    assert.deepEqual(long.slice(1).map((c) => c.prefix), ['/kategorie/a/x/x', '/kategorie/a/x', '/kategorie/a']);
  });
});
