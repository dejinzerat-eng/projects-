import type { ListingStatus } from '@prisma/client';

/** Skóre, od kterého jde inzerát místo zveřejnění ke schválení moderátorovi. */
export const REVIEW_SCORE = 50;

/**
 * Stav inzerátu po vložení nebo úpravě.
 * - koncept zůstává konceptem, dokud ho autor nezveřejní,
 * - zamítnutý inzerát se po opravě znovu posoudí (s předběžnou moderací jde vždy ke schválení),
 * - viditelný inzerát s rizikovým obsahem se stáhne ke schválení.
 */
export function nextStatus(input: { current?: ListingStatus; publish: boolean; premoderation: boolean; score: number }): ListingStatus {
  const { current, publish, premoderation, score } = input;
  const review = premoderation || score >= REVIEW_SCORE;
  if (!current || current === 'DRAFT') return publish ? (review ? 'PENDING' : 'ACTIVE') : 'DRAFT';
  if (current === 'REJECTED') return review ? 'PENDING' : 'ACTIVE';
  if (['ACTIVE', 'RESERVED', 'SOLD'].includes(current) && score >= REVIEW_SCORE) return 'PENDING';
  return current;
}

/**
 * Nová platnost: zveřejnění konceptu nebo znovu posouzený zamítnutý inzerát dostane plnou dobu,
 * jinak platnost zůstává (prodlužuje se tlačítkem Prodloužit).
 */
export function nextExpiry(input: { before?: ListingStatus; after: ListingStatus; expiresAt: Date | null; now: Date; days: number }): Date | null {
  const { before, after, expiresAt, now, days } = input;
  if (after === 'DRAFT') return null;
  const fresh = new Date(now.getTime() + days * 864e5);
  if (!before || before === 'DRAFT') return fresh;
  if (['ACTIVE', 'PENDING'].includes(after) && (!expiresAt || expiresAt.getTime() <= now.getTime() || before === 'REJECTED')) return fresh;
  return expiresAt;
}
