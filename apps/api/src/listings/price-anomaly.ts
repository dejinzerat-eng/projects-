/**
 * Kontrola podezřele nízké ceny vůči mediánu aktivních inzerátů v (pod)kategorii (čisté funkce, testy v price-anomaly.spec.ts).
 * Medián počítá ListingsService z aktivních inzerátů se stejným typem nabídky a měnou a drží ho v cache.
 */
export const LOW_PRICE_REASON = 'Podezřele nízká cena';
/** Cena pod 30 % mediánu je podezřelá (typický podvod: „iPhone za 3 000 Kč“). */
export const PRICE_ANOMALY_RATIO = 0.3;
/** Nejmenší počet aktivních inzerátů s cenou, ze kterého medián bereme vážně. */
export const PRICE_ANOMALY_MIN_SAMPLE = 8;
/** Riziko přičtené k skóre (samo o sobě inzerát ke schválení nepošle, s dalším signálem ano). */
export const PRICE_ANOMALY_SCORE = 30;
/** Typy nabídky, u kterých cena znamená cenu zboží (dar je zdarma, poptávka a výměna se nesrovnávají). */
export const PRICED_OFFER_TYPES = ['SELL', 'RENT'];

export interface PriceStats { median: number | null; sample: number }

/** Medián podkategorie, a když je v ní málo inzerátů, medián celé hlavní kategorie. */
export function pickPriceStats(sub: PriceStats | null, parent: PriceStats | null): PriceStats | null {
  for (const s of [sub, parent]) if (s && s.median != null && s.median > 0 && s.sample >= PRICE_ANOMALY_MIN_SAMPLE) return s;
  return null;
}

export function isPriceAnomaly(price: number | null | undefined, stats: PriceStats | null): boolean {
  if (price == null || price <= 0 || !stats || stats.median == null) return false;
  return price < stats.median * PRICE_ANOMALY_RATIO;
}
