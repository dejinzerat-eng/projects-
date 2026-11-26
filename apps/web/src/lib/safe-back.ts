/**
 * Návrat po přihlášení (?zpet=…) jen na cestu našeho webu – žádné otevřené přesměrování.
 * Řídicí znaky prohlížeč z adresy vypouští („/\t/cizi.cz“ by se změnilo na „//cizi.cz“), proto je odmítáme.
 */
export const safeBack = (z: string | null | undefined) => (z && z.length <= 500 && z.startsWith('/') && !z.startsWith('//') && !z.startsWith('/\\') && !/[\x00-\x1f\x7f]/.test(z) ? z : '/');

/** Adresa přihlášení, která uživatele po přihlášení vrátí na `back` (jen na náš web). */
export function loginUrl(back: string | null | undefined) {
  const z = safeBack(back);
  return z === '/' ? '/prihlaseni' : `/prihlaseni?zpet=${encodeURIComponent(z)}`;
}
