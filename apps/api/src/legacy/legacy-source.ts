/**
 * Čtení starého webu www.dejinzerat.cz přes jeho veřejná data SvelteKitu (`__data.json`).
 * Adresu lze změnit proměnnou LEGACY_SOURCE_URL (např. když starý web po přepnutí domény poběží jinde).
 */
import { findNode, parseSvelteKitData } from './devalue';
import { LEGACY_LISTING_ID, type LegacyListing } from './legacy-map';

export const DEFAULT_LEGACY_URL = 'https://www.dejinzerat.cz';
const PAGE_SIZE = 15;
const MAX_PAGES = 200;

export function legacyBaseUrl(): string {
  const raw = (process.env.LEGACY_SOURCE_URL ?? DEFAULT_LEGACY_URL).trim().replace(/\/+$/, '');
  const u = new URL(raw);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error('Neplatná adresa starého webu.');
  return u.origin;
}

export class LegacySource {
  constructor(readonly base = legacyBaseUrl(), private fetchImpl: typeof fetch = fetch, private timeoutMs = 20_000) {}

  private async get(path: string): Promise<Response> {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await this.fetchImpl(`${this.base}${path}`, { headers: { 'user-agent': 'Dejinzerat-import/1.0', accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(this.timeoutMs) });
        if (r.status >= 500 || r.status === 429) { last = new Error(`HTTP ${r.status}`); await new Promise((ok) => setTimeout(ok, 500 * (attempt + 1))); continue; }
        return r;
      } catch (e) { last = e; await new Promise((ok) => setTimeout(ok, 500 * (attempt + 1))); }
    }
    throw new Error(`Starý web neodpovídá (${path}): ${(last as Error)?.message ?? last}`);
  }

  private async data(path: string): Promise<unknown[]> {
    const r = await this.get(path);
    if (!r.ok) throw new Error(`Starý web vrátil ${r.status} pro ${path}`);
    return parseSvelteKitData(await r.json());
  }

  /** Jedna stránka výpisu „Nejnovější inzeráty“ (15 inzerátů) a počet stránek. */
  async page(n: number): Promise<{ listings: LegacyListing[]; pageCount: number }> {
    const nodes = await this.data(`/nejnovejsi-inzeraty/__data.json?page=${n}`);
    const listings = findNode<LegacyListing[]>(nodes, 'inzeraty') ?? [];
    const node = nodes.find((x) => x && typeof x === 'object' && 'inzeraty' in x) as { pageCount?: number } | undefined;
    return { listings: Array.isArray(listings) ? listings : [], pageCount: Number(node?.pageCount ?? 0) };
  }

  /** Všechny zveřejněné inzeráty. `complete` = podařilo se projít celý výpis (podle počtu stránek). */
  async allListings(): Promise<{ listings: LegacyListing[]; complete: boolean; pageCount: number }> {
    const first = await this.page(1);
    const pageCount = Math.min(first.pageCount || 1, MAX_PAGES);
    const pages = [first.listings];
    const rest = Array.from({ length: pageCount - 1 }, (_, i) => i + 2);
    for (let i = 0; i < rest.length; i += 4) {
      const chunk = await Promise.all(rest.slice(i, i + 4).map((n) => this.page(n)));
      pages.push(...chunk.map((c) => c.listings));
    }
    const seen = new Set<string>();
    const listings = pages.flat().map((l) => (l && l.InzeratId != null ? { ...l, InzeratId: String(l.InzeratId) } : l))
      .filter((l) => l && LEGACY_LISTING_ID.test(l.InzeratId) && !seen.has(l.InzeratId) && seen.add(l.InzeratId));
    // úplné jsou jen tehdy, když každá stránka kromě poslední byla plná
    const complete = pages.slice(0, -1).every((p) => p.length === PAGE_SIZE);
    return { listings, complete, pageCount };
  }

  /** Detail inzerátu včetně prodejce (e-mail, telefon). null = inzerát už na starém webu není. */
  async listing(id: string): Promise<LegacyListing | null> {
    if (!LEGACY_LISTING_ID.test(id)) throw new Error('Neplatné ID inzerátu.');
    const r = await this.get(`/produkt/__data.json?id=${id}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`Starý web vrátil ${r.status} pro inzerát ${id}`);
    const l = findNode<LegacyListing>(parseSvelteKitData(await r.json()), 'inzerat');
    return l && String(l.InzeratId) === id ? { ...l, InzeratId: String(l.InzeratId) } : null;
  }

  /** Fotka inzerátu (max. 15 MB). */
  async image(name: string): Promise<Buffer> {
    const r = await this.get(`/inzeraty_images/${encodeURIComponent(name)}`);
    if (!r.ok) throw new Error(`Fotka ${name}: HTTP ${r.status}`);
    const len = Number(r.headers.get('content-length') ?? 0);
    if (len > 15 * 1024 * 1024) throw new Error(`Fotka ${name} je příliš velká.`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) throw new Error(`Fotka ${name} je příliš velká.`);
    return buf;
  }
}
