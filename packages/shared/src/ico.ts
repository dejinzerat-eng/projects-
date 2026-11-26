/**
 * IČO (identifikační číslo osoby). Kontrolní číslice: vážený součet prvních 7 číslic (váhy 8…2),
 * c = (11 − součet mod 11) mod 10. Používá API (ověření před ARES) i web (nápověda ve formuláři).
 */
export function normalizeIco(raw: string): string {
  const d = raw.replace(/\s/g, '');
  return /^\d{1,8}$/.test(d) ? d.padStart(8, '0') : d;
}

export function isValidIco(raw: string): boolean {
  const ico = normalizeIco(raw);
  if (!/^\d{8}$/.test(ico) || ico === '00000000') return false;
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(ico[i]) * (8 - i);
  return (11 - (sum % 11)) % 10 === Number(ico[7]);
}
