/**
 * Identifikace provozovatele pro e-maily a texty. Hodnoty se berou z proměnných prostředí
 * (OPERATOR_NAME, OPERATOR_ICO, OPERATOR_ADDRESS, OPERATOR_REGISTRY, OPERATOR_EMAIL, OPERATOR_PHONE, OPERATOR_DSA_EMAIL);
 * jinak platí výchozí údaje provozovatele (ověřeno v ARES 27. 11. 2026); nevyplněný telefon zůstává v hranatých závorkách.
 */
export interface Operator { name: string; ico: string; address: string; registry: string; email: string; phone: string; dsaEmail: string }

export const OPERATOR_PLACEHOLDERS: Operator = {
  name: 'ESTI INTERNATIONAL s.r.o.',
  ico: '25020137',
  address: 'Hybernská 1007/20, Nové Město, 110 00 Praha 1',
  registry: 'obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 55087',
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
