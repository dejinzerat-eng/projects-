/**
 * Identifikace provozovatele pro e-maily a texty. Hodnoty se berou z proměnných prostředí
 * (OPERATOR_NAME, OPERATOR_ICO, OPERATOR_ADDRESS, OPERATOR_REGISTRY, OPERATOR_EMAIL, OPERATOR_PHONE, OPERATOR_DSA_EMAIL);
 * dokud nejsou vyplněné, zobrazí se zřetelné zástupné texty v hranatých závorkách.
 */
export interface Operator { name: string; ico: string; address: string; registry: string; email: string; phone: string; dsaEmail: string }

export const OPERATOR_PLACEHOLDERS: Operator = {
  name: '[Název provozovatele]',
  ico: '[IČO]',
  address: '[Sídlo provozovatele]',
  registry: '[Zápis v obchodním rejstříku]',
  email: 'podpora@dejinzerat.cz',
  phone: '[Telefon]',
  dsaEmail: '[E-mail kontaktního místa DSA]',
};

export function operatorFromEnv(env: Record<string, string | undefined> = process.env): Operator {
  const v = (k: string) => env[k]?.trim() || undefined;
  const email = v('OPERATOR_EMAIL') ?? OPERATOR_PLACEHOLDERS.email;
  return {
    name: v('OPERATOR_NAME') ?? OPERATOR_PLACEHOLDERS.name,
    ico: v('OPERATOR_ICO') ?? OPERATOR_PLACEHOLDERS.ico,
    address: v('OPERATOR_ADDRESS') ?? OPERATOR_PLACEHOLDERS.address,
    registry: v('OPERATOR_REGISTRY') ?? OPERATOR_PLACEHOLDERS.registry,
    email,
    phone: v('OPERATOR_PHONE') ?? OPERATOR_PLACEHOLDERS.phone,
    dsaEmail: v('OPERATOR_DSA_EMAIL') ?? email,
  };
}
