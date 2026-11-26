import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CATEGORIES, haversine, normalizeSearchText, queryWords, SearchParams, synonymMap } from '@dej/shared';
import { findMunicipality, suggestMunicipalities } from '@dej/shared/dist/municipalities';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import {
  backfillSearchTextSql, buildTerms, distanceSql, rankAt, filterSql, FROM_SQL, FUZZY_THRESHOLD, fuzzyScoreSql, Geo, MAX_RADIUS_KM, NORM_TITLE, orderSql,
  SEARCH_TEXT, setTrgmSchema, termsFuzzy, termsMatch, tierSql, wordPrefix, wordSimilar, wordSimilarity,
} from './search-query';

export { haversine };

export const LISTING_INCLUDE = {
  images: { orderBy: { position: 'asc' as const }, take: 1 },
  category: { include: { parent: true } },
  user: { select: { id: true, name: true, phoneVerifiedAt: true, emailVerifiedAt: true, isBusiness: true, companyName: true, companyVerifiedAt: true } },
} satisfies Prisma.ListingInclude;
type ListingWith = Prisma.ListingGetPayload<{ include: typeof LISTING_INCLUDE }>;

const ATTR_KEYS = [...new Set(CATEGORIES.flatMap((c) => [...c.filters, ...c.children.flatMap((s) => s.filters ?? [])].map((f) => f.key)))];
const PAGE = 24;

export interface ListingCard {
  id: string; slug: string; title: string; price: number | null; priceNegotiable: boolean; currency: string;
  city: string; region: string; condition: string | null; offerType: string; image: string | null; createdAt: number;
  /** isBusiness = firma s ověřeným IČO (štítek „Firma“); samotné označení „podnikatel“ nestačí */
  categorySlug: string; parentCategorySlug: string; categoryName: string; verified: boolean; isBusiness: boolean; isTop: boolean; highlighted: boolean;
  status: string; distanceKm?: number;
}

export interface SearchOptions {
  /** Jen inzeráty zveřejněné po tomto okamžiku (upozornění na uložená hledání) */
  publishedAfter?: Date;
  limit?: number;
  /** Když přesná shoda nic nenajde, zkusit podobná slova (výchozí ano, u upozornění ne) */
  fuzzy?: boolean;
}

export interface SearchResponse {
  hits: ListingCard[]; total: number; page: number; pages: number; facets: Record<string, Record<string, number>>; engine: string;
  /** Přesná shoda nebyla, výsledky jsou s opravou překlepů */
  fuzzy?: boolean;
  /** Bod, od kterého se počítá vzdálenost (pro „Nejblíže“ a „v okolí“) */
  origin?: { lat: number; lng: number; name?: string };
}

/**
 * Vyhledávání. S MEILI_URL přes Meilisearch, jinak (produkce) v PostgreSQL:
 * normalizovaný text bez diakritiky s trigram indexem, synonyma, oprava překlepů,
 * skutečný okruh v km (haversine) a řazení podle relevance → topování → data zveřejnění.
 */
@Injectable()
export class SearchService implements OnModuleInit {
  private log = new Logger('Search');
  private enabled = false;

  constructor(private prisma: PrismaService) {}

  private async meili(path: string, method = 'GET', body?: unknown) {
    const r = await fetch(`${config.meiliUrl}${path}`, {
      method, headers: { Authorization: `Bearer ${config.meiliKey}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Meilisearch ${method} ${path}: ${r.status} ${await r.text()}`);
    return r.json() as Promise<any>;
  }

  async onModuleInit() {
    await this.prisma.$queryRaw<{ s: string }[]>`SELECT n.nspname AS s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm'`
      .then((r) => setTrgmSchema(r[0]?.s))
      .catch((e) => this.log.warn(`Schéma pg_trgm se nepodařilo zjistit: ${(e as Error).message}`));
    if (!config.meiliUrl) { this.log.log('Meilisearch není nastaven – hledá se v PostgreSQL.'); return; }
    try {
      await this.meili('/health');
      await this.meili('/indexes', 'POST', { uid: 'listings', primaryKey: 'id' }).catch(() => undefined);
      await this.meili('/indexes/listings/settings', 'PATCH', {
        searchableAttributes: ['title', 'categoryName', 'attrText', 'description', 'city'],
        filterableAttributes: ['categorySlug', 'parentCategorySlug', 'price', 'priceCzk', 'privateSeller', 'city', 'region', 'condition', 'offerType', 'verified', 'isBusiness', 'createdAt', '_geo', 'status', 'userId', ...ATTR_KEYS.map((k) => `attr_${k}`)],
        sortableAttributes: ['price', 'priceCzk', 'createdAt', 'rankAt', '_geo'],
        rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness', 'rankAt:desc'],
        typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 5, twoTypos: 9 } },
        synonyms: synonymMap(),
        pagination: { maxTotalHits: 5000 },
      });
      this.enabled = true;
      this.log.log('Meilisearch připojen');
      const stats = await this.meili('/indexes/listings/stats').catch(() => ({ numberOfDocuments: 0 }));
      if (!stats.numberOfDocuments) setTimeout(() => this.reindexAll().then((n) => this.log.log(`Index naplněn: ${n}`)).catch(() => undefined), 1000);
    } catch (e) {
      this.log.warn(`Meilisearch není dostupný – použije se hledání v PostgreSQL. (${(e as Error).message})`);
    }
  }

  get usingMeili() { return this.enabled; }

  toCard(l: ListingWith, now = Date.now()): ListingCard {
    const parent = l.category.parent ?? l.category;
    return {
      id: l.id, slug: l.slug, title: l.title, price: l.price, priceNegotiable: l.priceNegotiable, currency: l.currency,
      city: l.city, region: l.region, condition: l.condition, offerType: l.offerType, image: l.images[0]?.thumbUrl ?? null,
      createdAt: (l.publishedAt ?? l.createdAt).getTime(), categorySlug: l.category.slug, parentCategorySlug: parent.slug, categoryName: l.category.name,
      verified: !!l.user.phoneVerifiedAt, isBusiness: !!l.user.isBusiness && !!l.user.companyVerifiedAt,
      isTop: !!l.topUntil && l.topUntil.getTime() > now, highlighted: !!l.highlightedUntil && l.highlightedUntil.getTime() > now,
      status: l.status,
    };
  }

  private toDoc(l: ListingWith) {
    const card = this.toCard(l);
    const attrs = (l.attributes ?? {}) as Record<string, unknown>;
    const doc: Record<string, unknown> = {
      ...card, description: l.description.slice(0, 2000), userId: l.userId, priceCzk: l.priceCzk, privateSeller: !l.user.isBusiness,
      // Konec propagace: isTop/highlighted se při hledání přepočítají; rankAt srovná pravidelná úloha přeindexováním
      topUntil: l.topUntil?.getTime() ?? 0, highlightedUntil: l.highlightedUntil?.getTime() ?? 0,
      rankAt: rankAt(l, Date.now()),
      attrText: Object.values(attrs).filter((v) => typeof v === 'string').join(' '),
    };
    for (const [k, v] of Object.entries(attrs)) doc[`attr_${k}`] = v;
    if (l.lat != null && l.lng != null) doc._geo = { lat: l.lat, lng: l.lng };
    return doc;
  }

  async index(listingId: string) {
    if (!this.enabled) return;
    const l = await this.prisma.listing.findUnique({ where: { id: listingId }, include: LISTING_INCLUDE });
    try {
      if (!l || !['ACTIVE', 'RESERVED'].includes(l.status)) await this.meili(`/indexes/listings/documents/${listingId}`, 'DELETE');
      else await this.meili('/indexes/listings/documents', 'POST', [this.toDoc(l)]);
    } catch (e) { this.log.error((e as Error).message); }
  }

  async reindexAll() {
    if (!this.enabled) return 0;
    await this.meili('/indexes/listings/documents', 'DELETE');
    let cursor: string | undefined; let n = 0;
    for (;;) {
      const batch = await this.prisma.listing.findMany({ where: { status: { in: ['ACTIVE', 'RESERVED'] } }, include: LISTING_INCLUDE, take: 500, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: 'asc' } });
      if (!batch.length) break;
      await this.meili('/indexes/listings/documents', 'POST', batch.map((l) => this.toDoc(l)));
      n += batch.length; cursor = batch[batch.length - 1].id;
    }
    return n;
  }

  /** Doplní searchText u inzerátů, kde chybí (např. po seedu). Vrací počet upravených řádků. */
  backfillSearchText(all = false) {
    return this.prisma.$executeRaw(backfillSearchTextSql(!all));
  }

  /** Bod pro vzdálenost: poloha uživatele, nebo obec z filtru (kterákoli obec ČR). */
  private geoOf(p: SearchParams): (Geo & { name?: string; region?: string }) | undefined {
    if (p.lat != null && p.lng != null) return { lat: Number(p.lat), lng: Number(p.lng) };
    if (!p.city) return undefined;
    const m = findMunicipality(p.city);
    return m ? { lat: m.lat, lng: m.lng, name: m.name, region: m.region } : undefined;
  }

  async search(p: SearchParams, opts: SearchOptions = {}): Promise<SearchResponse> {
    const page = Math.max(1, Math.min(200, Math.floor(Number(p.page) || 1)));
    const limit = Math.max(1, Math.min(60, opts.limit ?? PAGE));
    if (this.enabled) {
      try { return await this.searchMeili(p, page, limit, opts.publishedAfter); } catch (e) { this.log.error((e as Error).message); }
    }
    // Upozornění na uložená hledání posílají jen přesné shody, ne „podobné výsledky“
    return this.searchDb(p, page, limit, opts.publishedAfter, opts.fuzzy ?? !opts.publishedAfter);
  }

  private async searchMeili(p: SearchParams, page: number, limit: number, publishedAfter?: Date): Promise<SearchResponse> {
    const f: string[] = [];
    const esc = (s: string) => JSON.stringify(s);
    if (p.sub) f.push(`categorySlug = ${esc(p.sub)}`);
    else if (p.category) f.push(`parentCategorySlug = ${esc(p.category)}`);
    if (p.priceMin != null) f.push(`priceCzk >= ${Number(p.priceMin)}`);
    if (p.priceMax != null) f.push(`priceCzk <= ${Number(p.priceMax)}`);
    const geo = this.geoOf(p);
    if (geo && p.radius) f.push(`_geoRadius(${geo.lat}, ${geo.lng}, ${Math.min(MAX_RADIUS_KM, Number(p.radius)) * 1000})`);
    else if (p.city) f.push(`city = ${esc(geo?.name ?? p.city)}`);
    if (p.region) f.push(`region = ${esc(p.region)}`);
    if (p.condition?.length) f.push(`condition IN [${p.condition.map(esc).join(',')}]`);
    if (p.offerType) f.push(`offerType = ${esc(p.offerType)}`);
    if (p.verified) f.push('verified = true');
    if (p.sellerType) f.push(p.sellerType === 'business' ? 'isBusiness = true' : 'privateSeller = true');
    const since = publishedAfter?.getTime() ?? (p.since ? Date.now() - { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5 }[p.since] : undefined);
    if (since) f.push(`createdAt > ${since}`);
    for (const [k, v] of Object.entries(p.attrs ?? {})) {
      if (!ATTR_KEYS.includes(k)) continue;
      const a = `attr_${k}`;
      if (Array.isArray(v)) f.push(`${a} IN [${v.map(esc).join(',')}]`);
      else if (typeof v === 'boolean') f.push(`${a} = true`);
      else if (typeof v === 'object' && v) { if (v.min != null) f.push(`${a} >= ${Number(v.min)}`); if (v.max != null) f.push(`${a} <= ${Number(v.max)}`); }
      else if (typeof v === 'string') f.push(`${a} = ${esc(v)}`);
    }
    const sort: string[] = [];
    if (p.sort === 'newest') sort.push('createdAt:desc');
    else if (p.sort === 'price_asc') sort.push('priceCzk:asc');
    else if (p.sort === 'price_desc') sort.push('priceCzk:desc');
    else if (p.sort === 'distance' && geo) sort.push(`_geoPoint(${geo.lat}, ${geo.lng}):asc`);
    else if (!p.q) sort.push('rankAt:desc');
    const r = await this.meili('/indexes/listings/search', 'POST', {
      q: p.q ?? '', filter: f, sort, hitsPerPage: limit, page,
      facets: ['parentCategorySlug', 'categorySlug', 'condition'],
      attributesToRetrieve: ['id', 'slug', 'title', 'price', 'priceNegotiable', 'currency', 'city', 'region', 'condition', 'offerType', 'image', 'createdAt', 'categorySlug', 'parentCategorySlug', 'categoryName', 'verified', 'isBusiness', 'topUntil', 'highlightedUntil', 'status', '_geo'],
    });
    const now = Date.now();
    type Hit = Omit<ListingCard, 'isTop' | 'highlighted'> & { topUntil?: number; highlightedUntil?: number; _geo?: { lat: number; lng: number }; _geoDistance?: number };
    const hits = (r.hits as Hit[]).map(({ _geo, _geoDistance, topUntil, highlightedUntil, ...h }) => ({
      ...h, isTop: (topUntil ?? 0) > now, highlighted: (highlightedUntil ?? 0) > now, ...(geo && _geo ? { distanceKm: Math.round(haversine(geo, _geo)) } : {}),
    }));
    return { hits, total: r.totalHits as number, page, pages: r.totalPages as number, facets: r.facetDistribution as Record<string, Record<string, number>>, engine: 'meilisearch', ...(geo ? { origin: geo } : {}) };
  }

  private async searchDb(p: SearchParams, page: number, limit: number, publishedAfter?: Date, allowFuzzy = true): Promise<SearchResponse> {
    const now = new Date();
    const geo = this.geoOf(p);
    const cityKey = p.city && !(p.lat != null && p.lng != null) ? normalizeSearchText(geo?.name ?? p.city) : undefined;
    const where = filterSql(p, { geo, cityKey, cityRegion: geo?.region, publishedAfter, attrKeys: ATTR_KEYS, now });
    const terms = p.q ? buildTerms(p.q) : [];
    const phrase = p.q ? queryWords(p.q).join(' ') : '';
    const sort = p.sort === 'distance' && !geo ? undefined : p.sort;
    const select = geo ? Prisma.sql`l."id", COUNT(*) OVER() AS total, ${distanceSql(geo)} AS dist` : Prisma.sql`l."id", COUNT(*) OVER() AS total`;
    const offset = (page - 1) * limit;
    type Row = { id: string; total: bigint };

    /** Jedna stránka výsledků a celkový počet (COUNT(*) OVER(); za poslední stránkou zvlášť). */
    const fetchPage = async (conds: Prisma.Sql[], order: Prisma.Sql, fuzzyThreshold = false): Promise<{ rows: Row[]; total: number }> => {
      const cond = Prisma.join(conds, ' AND ');
      const pageSql = Prisma.sql`SELECT ${select} ${FROM_SQL} WHERE ${cond} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`;
      const countSql = Prisma.sql`SELECT COUNT(*) AS n ${FROM_SQL} WHERE ${cond}`;
      let rows: Row[];
      let counted: { n: bigint }[] | undefined;
      if (fuzzyThreshold) {
        // Oprava překlepů: nižší práh podobnosti jen pro tuto transakci (funguje i přes PgBouncer)
        const setThreshold = this.prisma.$queryRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(FUZZY_THRESHOLD)}, true)`;
        const [, r] = await this.prisma.$transaction([setThreshold, this.prisma.$queryRaw<Row[]>(pageSql)]);
        rows = r as Row[];
        if (!rows.length && page > 1) {
          const [, c] = await this.prisma.$transaction([this.prisma.$queryRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(FUZZY_THRESHOLD)}, true)`, this.prisma.$queryRaw<{ n: bigint }[]>(countSql)]);
          counted = c as { n: bigint }[];
        }
      } else {
        rows = await this.prisma.$queryRaw<Row[]>(pageSql);
        if (!rows.length && page > 1) counted = await this.prisma.$queryRaw<{ n: bigint }[]>(countSql);
      }
      return { rows, total: rows.length ? Number(rows[0].total) : Number(counted?.[0]?.n ?? 0) };
    };

    let res: { rows: Row[]; total: number };
    let fuzzy = false;
    if (!terms.length) {
      res = await fetchPage(where, orderSql(sort, { now, geo }));
    } else {
      res = await fetchPage([...where, termsMatch(SEARCH_TEXT, terms, true)], orderSql(sort, { now, geo, quality: tierSql(terms, phrase) }));
      const fz = allowFuzzy ? termsFuzzy(SEARCH_TEXT, terms) : undefined;
      if (res.total === 0 && fz) {
        const f = await fetchPage([...where, fz], orderSql(sort, { now, geo, quality: fuzzyScoreSql(terms, phrase) }), true);
        if (f.total > 0) { res = f; fuzzy = true; }
      }
    }
    const { rows, total } = res;

    const ids = rows.map((r) => r.id);
    const list = ids.length ? await this.prisma.listing.findMany({ where: { id: { in: ids } }, include: LISTING_INCLUDE }) : [];
    const byId = new Map(list.map((l) => [l.id, l]));
    const hits = ids.map((id) => byId.get(id)).filter((l): l is ListingWith => !!l).map((l) => ({
      ...this.toCard(l, now.getTime()),
      ...(geo && l.lat != null && l.lng != null ? { distanceKm: Math.round(haversine(geo, { lat: l.lat, lng: l.lng })) } : {}),
    }));
    return { hits, total, page, pages: Math.ceil(total / limit), facets: {}, engine: 'postgres', ...(fuzzy ? { fuzzy } : {}), ...(geo ? { origin: geo } : {}) };
  }

  /** Našeptávač: názvy inzerátů + kategorie + obce. Nezáleží na diakritice, snese i překlep. */
  async suggest(q: string) {
    const raw = q.trim().slice(0, 80);
    const nq = normalizeSearchText(raw);
    if (nq.length < 2) return { queries: [], categories: [], cities: [] };
    const words = nq.split(' ');
    const matches = (name: string) => { const n = normalizeSearchText(name); return words.every((w) => n.includes(w)); };
    const categories = CATEGORIES.flatMap((c) => [{ slug: c.slug, name: c.name, parent: null as string | null, parentName: null as string | null }, ...c.children.map((s) => ({ slug: s.slug, name: s.name, parent: c.slug, parentName: c.name }))])
      .filter((c) => matches(c.name)).slice(0, 4);
    const cities = [...new Set(suggestMunicipalities(raw, 3).map((c) => c.name))];
    let titles: string[] = [];
    if (this.enabled) {
      try {
        const r = await this.meili('/indexes/listings/search', 'POST', { q: raw, limit: 8, attributesToRetrieve: ['title'], filter: [] });
        titles = r.hits.map((h: { title: string }) => h.title);
      } catch { /* ignore */ }
    } else {
      titles = await this.suggestTitles(nq);
    }
    const queries = [...new Set(titles.map((t) => t.length > 48 ? t.slice(0, 48).replace(/\s\S*$/, '') : t))].slice(0, 6);
    return { queries, categories, cities };
  }

  private async suggestTitles(nq: string): Promise<string[]> {
    type R = { title: string };
    const status = Prisma.sql`l."status" IN ('ACTIVE', 'RESERVED')`;
    const rank = Prisma.sql`(CASE WHEN ${NORM_TITLE} LIKE ${`${nq}%`} THEN 0 WHEN ${wordPrefix(NORM_TITLE, nq)} THEN 1 ELSE 2 END), ${wordSimilarity(Prisma.sql`${nq}::text`, NORM_TITLE)} DESC, l."publishedAt" DESC NULLS LAST`;
    const exact = await this.prisma.$queryRaw<R[]>(Prisma.sql`SELECT l."title" FROM "Listing" l WHERE ${status} AND ${wordPrefix(SEARCH_TEXT, nq)} AND ${wordPrefix(NORM_TITLE, nq)} ORDER BY ${rank} LIMIT 8`);
    if (exact.length >= 3 || nq.length < 4) return exact.map((r) => r.title);
    const [, fz] = await this.prisma.$transaction([
      this.prisma.$queryRaw`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(FUZZY_THRESHOLD)}, true)`,
      this.prisma.$queryRaw<R[]>(Prisma.sql`SELECT l."title" FROM "Listing" l WHERE ${status} AND ${wordSimilar(Prisma.sql`${nq}::text`, SEARCH_TEXT)} AND ${wordSimilar(Prisma.sql`${nq}::text`, NORM_TITLE)} ORDER BY ${wordSimilarity(Prisma.sql`${nq}::text`, NORM_TITLE)} DESC, l."publishedAt" DESC NULLS LAST LIMIT 8`),
    ]);
    return [...new Set([...exact, ...(fz as R[])].map((r) => r.title))];
  }
}
