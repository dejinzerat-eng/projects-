/**
 * Souhlas s podmínkami používání. Verze podmínek je datum (RRRR-MM-DD, config.termsVersion);
 * účet bez uložené verze nebo se starší verzí musí nové podmínky odsouhlasit, než bude
 * zveřejňovat inzeráty nebo psát zprávy. Číst web může dál bez omezení.
 */
export const TERMS_OUTDATED_MESSAGE = 'Aktualizovali jsme podmínky používání. Než budete zveřejňovat inzeráty nebo psát zprávy, přečtěte si je prosím a potvrďte souhlas.';

export function termsOutdated(accepted: string | null | undefined, current: string): boolean {
  if (!accepted) return true;
  // verze jsou data ve tvaru RRRR-MM-DD, takže je lze porovnat jako text; jiný tvar = jiná verze
  const iso = /^\d{4}-\d{2}-\d{2}/;
  return iso.test(accepted) && iso.test(current) ? accepted < current : accepted !== current;
}
