import { z } from 'zod';

/** Počet URL v jednom souboru sitemapy (Google povoluje až 50 000). */
export const SITEMAP_CHUNK = 20_000;

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
  to: z.string().trim().min(1).max(500).refine((v) => v.startsWith('/') || /^https:\/\//.test(v), 'Cíl musí být cesta začínající „/“ nebo adresa https://.'),
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
