/**
 * Ochrana proti CSRF: zápisové požadavky (POST/PUT/PATCH/DELETE) musí mít hlavičku Origin z povolené adresy,
 * nebo – když ji prohlížeč nepošle – Referer ze stejné adresy. Bez obou se požadavek odmítne,
 * kromě klientů s tokenem v hlavičce Authorization bez cookie (prohlížeč takový požadavek z cizího webu nesestaví).
 */
export interface WriteRequest { method: string; path: string; origin?: string; referer?: string; hasCookie: boolean; hasBearer: boolean }

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
/** Odpověď Apple chodí jako POST z appleid.apple.com, chrání ji state + nonce. */
const EXEMPT = new Set(['/auth/apple/callback']);

export function originOf(url?: string): string | null {
  if (!url) return null;
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : null; } catch { return null; }
}

export function isTrustedWrite(r: WriteRequest, allowed: Set<string>): boolean {
  if (SAFE.has(r.method.toUpperCase())) return true;
  if (EXEMPT.has(r.path.replace(/\/+$/, ''))) return true;
  if (r.origin) return allowed.has(r.origin);
  const ref = originOf(r.referer);
  if (ref) return allowed.has(ref);
  return r.hasBearer && !r.hasCookie;
}
