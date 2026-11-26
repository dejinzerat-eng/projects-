import { timingSafeEqual } from 'crypto';

/** Návratová adresa po přihlášení: jen cesta na našem webu (ne //cizi.cz ani absolutní URL). */
export function safeBack(z?: string | null): string {
  if (!z || typeof z !== 'string' || z.length > 500) return '/';
  if (!z.startsWith('/') || z.startsWith('//') || z.startsWith('/\\') || /[\x00-\x1f\x7f]/.test(z)) return '/';
  return z;
}

export interface OAuthState { state: string; nonce: string; back: string }

/** Obsah cookie s rozpracovaným OAuth přihlášením: state, nonce a návratová adresa. */
export function packOAuthState(s: OAuthState) {
  return `${s.state}.${s.nonce}.${Buffer.from(safeBack(s.back)).toString('base64url')}`;
}

export function unpackOAuthState(v?: string | null): OAuthState | null {
  if (!v || typeof v !== 'string') return null;
  const [state, nonce, back] = v.split('.');
  if (!state || !nonce || back === undefined) return null;
  let path = '/';
  try { path = Buffer.from(back, 'base64url').toString(); } catch { /* */ }
  return { state, nonce, back: safeBack(path) };
}

/** Porovnání state z odpovědi poskytovatele s cookie (v konstantním čase). */
export function sameState(a?: string | null, b?: string | null) {
  if (!a || !b || typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
