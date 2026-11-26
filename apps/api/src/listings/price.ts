/** Výchozí kurz EUR → Kč, dokud administrátor v nastavení neuloží jiný (eurRate). */
export const DEFAULT_EUR_RATE = 25;
const MAX_INT = 2_147_483_647;

/**
 * Cena přepočtená na Kč pro řazení a filtr ceny (sloupec Listing.priceCzk).
 * Kč zůstávají beze změny, eura se násobí pevným kurzem a zaokrouhlí na celé koruny.
 */
export function priceInCzk(price: number | null | undefined, currency: string | null | undefined, eurRate: number): number | null {
  if (price == null || !Number.isFinite(price)) return null;
  if (currency !== 'EUR') return Math.round(price);
  const rate = Number.isFinite(eurRate) && eurRate > 0 ? eurRate : DEFAULT_EUR_RATE;
  return Math.min(MAX_INT, Math.round(price * rate));
}
