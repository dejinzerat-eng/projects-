import { createHash } from 'crypto';

/**
 * Normalizace textu pro hledání duplicit: malá písmena, bez diakritiky,
 * jen písmena a číslice oddělené jednou mezerou.
 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD').replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Otisk obsahu inzerátu – shodný pro texty, které se liší jen velikostí písmen, diakritikou, interpunkcí a mezerami. */
export function contentHash(title: string, description: string): string {
  return createHash('sha256').update(`${normalizeText(title)}\n${normalizeText(description)}`).digest('hex').slice(0, 40);
}

/** Hammingova vzdálenost dvou 64bitových otisků. */
export function hamming(a: bigint, b: bigint): number {
  let x = BigInt.asUintN(64, a ^ b);
  let n = 0;
  while (x) { x &= x - 1n; n++; }
  return n;
}

/** Fotky s takto blízkým otiskem považujeme za tutéž fotku (i po zmenšení či přeuložení). */
export const PHASH_MAX_DISTANCE = 5;

/**
 * Otisk, který nic neříká (jednobarevná nebo téměř jednobarevná plocha) – takové fotky neporovnáváme,
 * jinak by se „shodovaly“ všechny prázdné obrázky.
 */
export function isWeakHash(h: bigint): boolean {
  const ones = hamming(h, 0n);
  return ones <= 4 || ones >= 60;
}

/**
 * dHash z 9×8 šedotónových pixelů (řádek po řádku): bit = levý pixel jasnější než pravý.
 * Vrací podepsané 64bitové číslo (sloupec BIGINT v Postgresu).
 */
export function dHashFromPixels(px: Uint8Array | Buffer): bigint {
  if (px.length < 72) throw new Error('dHash potřebuje 9×8 pixelů');
  let h = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      h = (h << 1n) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return BigInt.asIntN(64, h);
}
