/**
 * IČO (identifikační číslo osoby) a registr ARES. Kontrolní součet IČO je ve sdíleném balíčku (používá ho i web).
 */
import { isValidIco, normalizeIco } from '@dej/shared';

export { isValidIco, normalizeIco };

export type AresResult =
  | { status: 'found'; name: string; address: string | null; vatId: string | null }
  | { status: 'ceased' }
  | { status: 'not_found' }
  | { status: 'error'; reason: string };

const ARES_URL = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty';

interface AresSidlo { textovaAdresa?: string; nazevUlice?: string; nazevCastiObce?: string; nazevObce?: string; cisloDomovni?: number; cisloOrientacni?: number; cisloOrientacniPismeno?: string; psc?: number | string }
interface AresSubject { ico?: string; obchodniJmeno?: string; sidlo?: AresSidlo; dic?: string; datumZaniku?: string }

/** Sídlo jako jeden řádek: ARES většinou posílá hotovou textovaAdresa, jinak ji složíme. */
export function formatAresAddress(s?: AresSidlo): string | null {
  if (!s) return null;
  if (s.textovaAdresa?.trim()) return s.textovaAdresa.trim();
  const no = [s.cisloDomovni, s.cisloOrientacni ? `${s.cisloOrientacni}${s.cisloOrientacniPismeno ?? ''}` : null].filter(Boolean).join('/');
  const street = [s.nazevUlice ?? s.nazevCastiObce, no].filter(Boolean).join(' ');
  const psc = s.psc ? String(s.psc).replace(/^(\d{3})(\d{2})$/, '$1 $2') : null;
  const city = [psc, s.nazevObce].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || null;
}

export function parseAresSubject(body: unknown): AresResult {
  const b = body as AresSubject | null;
  if (!b || typeof b !== 'object' || !b.obchodniJmeno) return { status: 'error', reason: 'Neočekávaná odpověď ARES' };
  if (b.datumZaniku) return { status: 'ceased' };
  return { status: 'found', name: b.obchodniJmeno.trim(), address: formatAresAddress(b.sidlo), vatId: b.dic?.trim() || null };
}

/**
 * Dotaz do ARES (veřejné API bez klíče). Výpadek nebo pomalá odpověď vrací status 'error',
 * volající pak účet ponechá jako neověřený. ARES_API_URL umožňuje adresu přesměrovat (testy).
 */
export async function lookupAres(ico: string, fetchImpl: typeof fetch = fetch, timeoutMs = 5000): Promise<AresResult> {
  const base = (process.env.ARES_API_URL?.trim() || ARES_URL).replace(/\/$/, '');
  try {
    const r = await fetchImpl(`${base}/${encodeURIComponent(normalizeIco(ico))}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (r.status === 404) return { status: 'not_found' };
    if (!r.ok) return { status: 'error', reason: `ARES HTTP ${r.status}` };
    return parseAresSubject(await r.json());
  } catch (e) {
    return { status: 'error', reason: (e as Error).message };
  }
}

/** Odkaz na veřejný výpis subjektu v ARES. */
export const aresWebUrl = (ico: string) => `https://ares.gov.cz/ekonomicke-subjekty?ico=${normalizeIco(ico)}`;
