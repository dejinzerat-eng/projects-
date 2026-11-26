import { createPublicKey, verify, type JsonWebKey } from 'crypto';

export interface IdTokenClaims { iss?: string; aud?: string | string[]; sub?: string; exp?: number; iat?: number; nonce?: string; email?: string; email_verified?: boolean | string; [k: string]: unknown }

export function decodeJwt(token: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Neplatný token.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()) as { alg?: string; kid?: string };
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as IdTokenClaims;
  return { header, claims, signingInput: `${parts[0]}.${parts[1]}`, signature: Buffer.from(parts[2], 'base64url') };
}

/** Ověří podpis RS256 proti sadě veřejných klíčů (JWKS) a vrátí claims. */
export function verifyRs256(token: string, keys: (JsonWebKey & { kid?: string })[]): IdTokenClaims {
  const { header, claims, signingInput, signature } = decodeJwt(token);
  if (header.alg !== 'RS256') throw new Error('Nepodporovaný algoritmus tokenu.');
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Neznámý klíč tokenu.');
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  if (!verify('RSA-SHA256', Buffer.from(signingInput), key, signature)) throw new Error('Neplatný podpis tokenu.');
  return claims;
}

/** Kontrola vydavatele, adresáta, platnosti a nonce v id_tokenu (OpenID Connect). */
export function checkIdTokenClaims(c: IdTokenClaims, opts: { iss: string; aud: string; nonce?: string; now?: number; skewSec?: number }) {
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  const skew = opts.skewSec ?? 60;
  if (c.iss !== opts.iss) throw new Error('Token vydal někdo jiný.');
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (!aud.includes(opts.aud)) throw new Error('Token je určený jiné aplikaci.');
  if (typeof c.exp !== 'number' || c.exp + skew < now) throw new Error('Platnost tokenu vypršela.');
  if (typeof c.iat === 'number' && c.iat - skew > now) throw new Error('Token je vydaný v budoucnosti.');
  if (opts.nonce !== undefined && c.nonce !== opts.nonce) throw new Error('Nesouhlasí nonce.');
  if (!c.sub) throw new Error('Token neobsahuje identitu.');
  return c;
}
