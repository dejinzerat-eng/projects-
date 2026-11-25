import { randomInt } from 'crypto';
import { z } from 'zod';

/**
 * Kategorie oznámení nezákonného obsahu (čl. 16 DSA). U sexuálního zneužívání dětí
 * nesmíme vyžadovat jméno ani e-mail oznamovatele (čl. 16 odst. 2 písm. c) DSA).
 */
export const NOTICE_CATEGORIES = {
  PODVOD: 'Podvod nebo klamavá nabídka',
  ZAKAZANE_ZBOZI: 'Zakázané nebo regulované zboží (zbraně, drogy, léky…)',
  DUSEVNI_VLASTNICTVI: 'Porušení autorských práv nebo ochranné známky (padělky)',
  OSOBNI_UDAJE: 'Zneužití osobních údajů nebo soukromí',
  NENAVIST: 'Nenávistný projev, výhrůžky, podněcování k násilí',
  ZVIRATA: 'Týrání nebo nelegální prodej zvířat',
  ZNEUZITI_DETI: 'Sexuální zneužívání dětí',
  JINE: 'Jiný nezákonný obsah',
} as const;
export type NoticeCategory = keyof typeof NOTICE_CATEGORIES;
export const ANONYMOUS_ALLOWED: NoticeCategory[] = ['ZNEUZITI_DETI'];

export const NoticeDto = z.object({
  category: z.enum(Object.keys(NOTICE_CATEGORIES) as [NoticeCategory, ...NoticeCategory[]], { error: 'Vyberte, o jaký nezákonný obsah jde.' }),
  targetUrl: z.string().trim().max(500).url('Zadejte přesnou adresu (URL) obsahu, např. odkaz na inzerát.').regex(/^https?:\/\//i, 'Adresa musí začínat http:// nebo https://.'),
  explanation: z.string().trim().min(30, 'Popište prosím alespoň dvěma větami, proč je obsah podle vás nezákonný (min. 30 znaků).').max(5000, 'Vysvětlení může mít nejvýše 5000 znaků.'),
  name: z.string().trim().max(120).optional().or(z.literal('')),
  email: z.string().trim().max(200).email('Zadejte platný e-mail.').optional().or(z.literal('')),
  goodFaith: z.literal(true, { error: 'Potvrďte prosím, že oznámení podáváte v dobré víře.' }),
  captcha: z.string().max(4000).optional(),
}).superRefine((v, ctx) => {
  if (ANONYMOUS_ALLOWED.includes(v.category)) return;
  if (!v.name) ctx.addIssue({ code: 'custom', path: ['name'], message: 'Uveďte své jméno (u tohoto typu oznámení je povinné).' });
  if (!v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Uveďte e-mail, na který vám pošleme potvrzení a rozhodnutí.' });
});
export type NoticeInput = z.infer<typeof NoticeDto>;

export const AppealDto = z.object({
  listing: z.string().trim().min(5, 'Zadejte odkaz nebo ID inzerátu.').max(500),
  text: z.string().trim().min(20, 'Popište prosím, proč s rozhodnutím nesouhlasíte (min. 20 znaků).').max(5000),
});

export const DecideNoticeDto = z.object({
  status: z.enum(['ACTION_TAKEN', 'NO_ACTION']),
  action: z.enum(['none', 'reject', 'delete']).default('none'),
  reason: z.string().trim().min(10, 'Odůvodnění musí mít alespoň 10 znaků – pošle se oznamovateli i autorovi obsahu.').max(2000),
});
export const DecideAppealDto = z.object({
  status: z.enum(['UPHELD', 'REJECTED']),
  reason: z.string().trim().min(10, 'Odůvodnění musí mít alespoň 10 znaků.').max(2000),
});

/** Rozpozná z URL náš inzerát nebo profil (cuid v cestě /inzerat/:id/… nebo /uzivatel/:id). */
export function parseTarget(url: string): { targetType: 'LISTING' | 'USER'; targetId: string } | null {
  let path: string;
  try { path = new URL(url).pathname; } catch { path = url; }
  const m = path.match(/^\/inzerat\/([a-z0-9]{20,40})(?:\/|$)/i);
  if (m) return { targetType: 'LISTING', targetId: m[1] };
  const u = path.match(/^\/uzivatel\/([a-z0-9]{20,40})(?:\/|$)/i);
  if (u) return { targetType: 'USER', targetId: u[1] };
  return null;
}

/** Vytáhne ID inzerátu z odkazu nebo přímo zadaného ID. */
export function listingIdFrom(input: string): string | null {
  const s = input.trim();
  if (/^[a-z0-9]{20,40}$/i.test(s)) return s;
  const t = parseTarget(s.startsWith('/') || /^https?:/i.test(s) ? s : `/${s}`);
  return t?.targetType === 'LISTING' ? t.targetId : null;
}

// Bez znaků, které se pletou (0/O, 1/I/L)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
/** Číslo oznámení, např. DSA-2026-7KX4QP (prefix DSA pro oznámení, NAM pro námitky). */
export function makeRef(prefix: 'DSA' | 'NAM', now = new Date(), rnd: (max: number) => number = randomInt) {
  let code = '';
  for (let i = 0; i < 6; i++) code += ALPHABET[rnd(ALPHABET.length)];
  return `${prefix}-${now.getFullYear()}-${code}`;
}

export const REF_RE = /^(DSA|NAM)-\d{4}-[2-9A-HJKMNP-Z]{6}$/;

/** Souhrn pro zprávu o transparentnosti (čl. 15 a 24 DSA). */
export function transparencySummary(rows: { category: string; status: string; createdAt: Date; decidedAt: Date | null }[]) {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const hours: number[] = [];
  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1;
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.decidedAt) hours.push((r.decidedAt.getTime() - r.createdAt.getTime()) / 36e5);
  }
  hours.sort((a, b) => a - b);
  const median = hours.length ? (hours.length % 2 ? hours[(hours.length - 1) / 2] : (hours[hours.length / 2 - 1] + hours[hours.length / 2]) / 2) : null;
  return { total: rows.length, byCategory, byStatus, decided: hours.length, medianHours: median == null ? null : Math.round(median * 10) / 10 };
}

/** Escapování textu do HTML e-mailu. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
