'use client';

/**
 * Zájmy návštěvníka pro „Doporučeno pro vás“ – kategorie prohlížených a oblíbených inzerátů.
 * Ukládá se jen v prohlížeči (localStorage), přihlášenému uživateli server přidá kategorie oblíbených.
 */
const KEY = 'dej_interest';
const MAX = 30;

export interface Interest { id: string; cat: string; sub: string; t: number }

export function readInterests(): Interest[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.id === 'string' && typeof x.cat === 'string' && typeof x.sub === 'string') : [];
  } catch { return []; }
}

export function rememberInterest(i: { id: string; cat: string; sub: string }) {
  if (!i.cat || !i.sub || i.cat === i.sub) return;
  try {
    const list = [{ ...i, t: Date.now() }, ...readInterests().filter((x) => x.id !== i.id)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* soukromý režim */ }
}

/** Parametry pro GET /search/recommended: kategorie (nejnovější první) a už viděné inzeráty. */
export function interestQuery(): { kat: string; bez: string } | null {
  const list = readInterests();
  if (!list.length) return null;
  const kat = [...new Set(list.map((x) => `${x.cat}/${x.sub}`))].slice(0, 10).join(',');
  const bez = list.map((x) => x.id).slice(0, 30).join(',');
  return { kat, bez };
}
