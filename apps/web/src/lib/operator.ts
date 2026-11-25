import 'server-only';
import { api } from './api';
import { SITE } from './seo';

/** Identifikace provozovatele (patička, Kontakt, právní texty). */
export interface Operator { name: string; ico: string; address: string; registry: string; email: string; phone: string; dsaEmail: string }

export const OPERATOR_PLACEHOLDERS: Operator = {
  name: '[Název provozovatele]', ico: '[IČO]', address: '[Sídlo provozovatele]', registry: '[Zápis v obchodním rejstříku]',
  email: 'podpora@dejinzerat.cz', phone: '[Telefon]', dsaEmail: '[E-mail kontaktního místa DSA]',
};

const pick = (o: Record<string, unknown> | undefined, ...keys: string[]) => {
  for (const k of keys) { const v = o?.[k]; if (typeof v === 'string' && v.trim()) return v.trim(); }
  return undefined;
};

/**
 * Pořadí zdrojů: systémová nastavení z administrace (GET /settings/public, pokud existuje),
 * proměnné prostředí OPERATOR_* a nakonec zřetelné zástupné texty v hranatých závorkách.
 */
export async function getOperator(): Promise<Operator> {
  let s: Record<string, unknown> | undefined;
  try {
    const r = await api<Record<string, unknown>>('/settings/public', { revalidate: 300, auth: false });
    s = (r.operator && typeof r.operator === 'object' ? r.operator : r.provozovatel && typeof r.provozovatel === 'object' ? r.provozovatel : r) as Record<string, unknown>;
  } catch { /* nastavení zatím nejsou k dispozici */ }
  const env = process.env;
  const email = pick(s, 'email', 'supportEmail', 'operatorEmail') ?? env.OPERATOR_EMAIL ?? OPERATOR_PLACEHOLDERS.email;
  return {
    name: pick(s, 'name', 'nazev', 'companyName', 'operatorName') ?? env.OPERATOR_NAME ?? OPERATOR_PLACEHOLDERS.name,
    ico: pick(s, 'ico', 'companyId', 'operatorIco') ?? env.OPERATOR_ICO ?? OPERATOR_PLACEHOLDERS.ico,
    address: pick(s, 'address', 'sidlo', 'operatorAddress') ?? env.OPERATOR_ADDRESS ?? OPERATOR_PLACEHOLDERS.address,
    registry: pick(s, 'registry', 'rejstrik', 'operatorRegistry') ?? env.OPERATOR_REGISTRY ?? OPERATOR_PLACEHOLDERS.registry,
    email,
    phone: pick(s, 'phone', 'telefon', 'supportPhone', 'operatorPhone') ?? env.OPERATOR_PHONE ?? OPERATOR_PLACEHOLDERS.phone,
    dsaEmail: pick(s, 'dsaEmail', 'dsaContact') ?? env.OPERATOR_DSA_EMAIL ?? email,
  };
}

export const isPlaceholder = (v: string) => v.startsWith('[');

/** Nahradí v textu stránky značky {{provozovatel}}, {{ico}}… údaji provozovatele. */
export function fillTokens(text: string, o: Operator) {
  const map: Record<string, string> = { provozovatel: o.name, ico: o.ico, sidlo: o.address, rejstrik: o.registry, email: o.email, telefon: o.phone, dsa_email: o.dsaEmail, web: SITE.replace(/^https?:\/\//, '') };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => map[k] ?? m);
}
