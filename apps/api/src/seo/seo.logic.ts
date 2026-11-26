import { z } from 'zod';

/** Počet URL v jednom souboru sitemapy (Google povoluje 50 000; menší soubory se vejdou do limitu odpovědi Vercelu 4,5 MB i do datové cache Next.js 2 MB). */
export const SITEMAP_CHUNK = 10_000;

const DAY = 864e5;
/**
 * Inzerát je pro vyhledávače „pryč“ (přesměrujeme na kategorii), když ho smazal autor nebo moderace,
 * byl zamítnut, déle než 30 dní vypršel nebo je déle než 60 dní prodaný.
 */
export function isGone(l: { status: string; expiresAt: Date | null; updatedAt: Date }, now = new Date()) {
  if (l.status === 'DELETED' || l.status === 'REJECTED') return true;
  if (l.status === 'EXPIRED') return !l.expiresAt || now.getTime() - l.expiresAt.getTime() > 30 * DAY;
  if (l.status === 'SOLD') return now.getTime() - l.updatedAt.getTime() > 60 * DAY;
  return false;
}

/** Sjednotí cestu pro tabulku přesměrování: bez domény, dotazu, kotvy a koncového lomítka. */
export function normalizePath(input: string): string | null {
  let p = input.trim();
  if (!p) return null;
  try { if (/^https?:\/\//i.test(p)) p = new URL(p).pathname; } catch { return null; }
  p = p.split(/[?#]/)[0];
  try { p = decodeURI(p); } catch { /* ponecháme */ }
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p.toLowerCase();
}

export const RedirectDto = z.object({
  from: z.string().trim().min(2).max(500),
  // „//host“ a „/\host“ by prohlížeč vzal jako jinou doménu – cesta musí být opravdu relativní
  to: z.string().trim().min(1).max(500).refine((v) => /^\/(?![/\\])/.test(v) || /^https:\/\/[^/\\]/.test(v), 'Cíl musí být cesta začínající „/“ nebo adresa https://.'),
  code: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(308),
}).transform((v, ctx) => {
  const from = normalizePath(v.from);
  if (!from || from === '/' || from.startsWith('/api/') || from.startsWith('/_next/')) {
    ctx.addIssue({ code: 'custom', path: ['from'], message: 'Zdrojová adresa musí být cesta na webu (ne úvodní stránka ani /api).' });
    return z.NEVER;
  }
  if (normalizePath(v.to) === from) {
    ctx.addIssue({ code: 'custom', path: ['to'], message: 'Přesměrování nesmí vést samo na sebe.' });
    return z.NEVER;
  }
  return { ...v, from };
});

export const PageMetaDto = z.object({
  description: z.string().trim().max(300).nullable().optional(),
  effectiveFrom: z.string().date('Datum zadejte ve tvaru RRRR-MM-DD.').nullable().optional().or(z.literal('')),
  reviewedAt: z.string().date('Datum zadejte ve tvaru RRRR-MM-DD.').nullable().optional().or(z.literal('')),
});

export const toDate = (v: string | null | undefined) => (v ? new Date(`${v}T00:00:00Z`) : null);

/** Adresa výpisu kategorie (hlavní nebo podkategorie). */
export const categoryPath = (slug: string, parentSlug?: string | null) => (parentSlug ? `/kategorie/${parentSlug}/${slug}` : `/kategorie/${slug}`);

/**
 * Trvalá přesměrování po změně adresy kategorie (slug nebo přesun pod jinou hlavní kategorii).
 * U hlavní kategorie se přesměrují i adresy všech jejích podkategorií.
 */
export function categoryRedirects(
  before: { slug: string; parentSlug: string | null },
  after: { slug: string; parentSlug: string | null },
  childSlugs: string[] = [],
): { from: string; to: string }[] {
  const from = categoryPath(before.slug, before.parentSlug), to = categoryPath(after.slug, after.parentSlug);
  if (from === to) return [];
  // Podkategorie existují jen pod hlavní kategorií – když kategorie zůstala hlavní, posunou se s ní
  const children = !before.parentSlug && !after.parentSlug ? childSlugs.map((c) => ({ from: `${from}/${c}`, to: `${to}/${c}` })) : [];
  return [{ from, to }, ...children];
}

/**
 * Kandidáti pro vyhledání přesměrování: nejdřív přesná adresa, u výpisů kategorií pak i kratší začátky,
 * aby se např. /kategorie/stara/mesto/praha přesměrovala podle pravidla pro /kategorie/stara (zbytek cesty se připojí).
 */
export function redirectCandidates(path: string): { prefix: string; rest: string }[] {
  const out = [{ prefix: path, rest: '' }];
  if (!path.startsWith('/kategorie/')) return out;
  const parts = path.split('/');
  for (let n = parts.length - 1; n >= 3; n--) out.push({ prefix: parts.slice(0, n).join('/'), rest: `/${parts.slice(n).join('/')}` });
  return out;
}
