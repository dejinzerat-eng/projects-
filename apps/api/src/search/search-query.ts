import { Prisma } from '@prisma/client';
import { DIACRITICS_FROM, DIACRITICS_TO, queryWords, SearchParams, stemCz, synonymsOf } from '@dej/shared';

/**
 * Sestavení SQL pro vyhledávání v PostgreSQL (produkce běží bez Meilisearch).
 * Text se hledá ve sloupci Listing."searchText" (malá písmena bez diakritiky, GIN trigram index).
 */

/** Jedno slovo dotazu: inzerát musí splnit aspoň jednu alternativu; alternativa = všechny podřetězce. */
export interface Term { word: string; alts: string[][] }

const STOPWORDS = new Set(['a', 'i', 'v', 've', 'na', 's', 'se', 'z', 'ze', 'k', 'ke', 'o', 'u', 'do', 'pro', 'po', 'za', 'od', 'the', 'and']);
/** Slova kratší než tato délka se při opravě překlepů neporovnávají podobností (jen přesně). */
export const FUZZY_MIN_LEN = 4;
/** Práh word_similarity pro opravu překlepů („iphoen“ → „iphone“ má 0,57). */
export const FUZZY_THRESHOLD = 0.45;

/** Odstraní alternativy, které jsou nadmnožinou kratší alternativy („kocarek“ je zbytečné vedle „kocar“). */
function prune(alts: string[][]): string[][] {
  const singles = alts.filter((a) => a.length === 1).map((a) => a[0]);
  const seen = new Set<string>();
  return alts.filter((a) => {
    const k = a.join('&');
    if (seen.has(k)) return false;
    seen.add(k);
    return !(a.length === 1 && singles.some((s) => s !== a[0] && a[0].includes(s))) && !(a.length > 1 && a.some((p) => singles.some((s) => p.includes(s))));
  });
}

/**
 * Rozloží dotaz na slova se synonymy a zkrácenými tvary.
 * „Horské kolo“ je jedna fráze se synonymy (mtb, horák) nebo obě slova kdekoli v textu.
 */
export function buildTerms(q: string): Term[] {
  let words = queryWords(q);
  if (words.length > 1) words = words.filter((w) => !STOPWORDS.has(w));
  const terms: Term[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    if (next) {
      const phrase = `${w} ${next}`;
      const syn = synonymsOf(phrase);
      if (syn.length > 1) {
        terms.push({ word: phrase, alts: prune([...syn.map((s) => [s]), [stemCz(w), stemCz(next)]]) });
        i++;
        continue;
      }
    }
    const stem = stemCz(w);
    const variants = new Set([w, stem, ...synonymsOf(w), ...synonymsOf(stem)]);
    terms.push({ word: w, alts: prune([...variants].map((v) => [v])) });
  }
  return terms;
}

/** Normalizace sloupce v SQL – stejný výsledek jako normalizeSearchText() v aplikaci. */
export function sqlNorm(col: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`btrim(regexp_replace(lower(translate(${col}, ${DIACRITICS_FROM}::text, ${DIACRITICS_TO}::text)), '[^a-z0-9]+', ' ', 'g'))`;
}

/** Výraz obsahuje slovo začínající na `p` („kocar“ najde „kocarek“, ale „sedacka“ nenajde „autosedacka“). */
export function wordPrefix(expr: Prisma.Sql, p: string): Prisma.Sql {
  return Prisma.sql`(${expr} LIKE ${`${p}%`} OR ${expr} LIKE ${`% ${p}%`})`;
}

/** Podmínka: výraz obsahuje všechna slova dotazu (každé aspoň v jedné alternativě). */
export function termsMatch(expr: Prisma.Sql, terms: Term[]): Prisma.Sql {
  return Prisma.join(terms.map((t) => Prisma.sql`(${Prisma.join(t.alts.map((a) => Prisma.sql`(${Prisma.join(a.map((p) => wordPrefix(expr, p)), ' AND ')})`), ' OR ')})`), ' AND ');
}

/** Podmínka pro opravu překlepů: delší slova stačí podobná (operátor <% používá trigram index). */
export function termsFuzzy(expr: Prisma.Sql, terms: Term[]): Prisma.Sql | undefined {
  if (!terms.some((t) => t.word.length >= FUZZY_MIN_LEN)) return undefined;
  return Prisma.join(terms.map((t) => {
    const exact = termsMatch(expr, [t]);
    return t.word.length >= FUZZY_MIN_LEN ? Prisma.sql`(${exact} OR ${t.word}::text <% ${expr})` : exact;
  }), ' AND ');
}

export const SEARCH_TEXT = Prisma.sql`l."searchText"`;
export const NORM_TITLE = sqlNorm(Prisma.sql`l."title"`);

export interface Geo { lat: number; lng: number }

/** Přesná vzdálenost v km (haversine) mezi inzerátem a bodem. */
export function distanceSql(g: Geo): Prisma.Sql {
  return Prisma.sql`(2 * 6371 * asin(least(1, sqrt(power(sin(radians(l."lat" - ${g.lat}::float8) / 2), 2) + cos(radians(${g.lat}::float8)) * cos(radians(l."lat")) * power(sin(radians(l."lng" - ${g.lng}::float8) / 2), 2)))))`;
}

/** Ohraničující obdélník kolem kruhu – rychlé předfiltrování přes index (lat, lng). */
export function boundingBox(g: Geo, km: number) {
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.max(0.01, Math.cos((g.lat * Math.PI) / 180)));
  return { minLat: g.lat - dLat, maxLat: g.lat + dLat, minLng: g.lng - dLng, maxLng: g.lng + dLng };
}

export const MAX_RADIUS_KM = 500;
const SINCE_MS: Record<NonNullable<SearchParams['since']>, number> = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5 };

export interface FilterOptions {
  geo?: Geo;
  /** Normalizovaný název města pro filtr „jen město“ */
  cityKey?: string;
  publishedAfter?: Date;
  attrKeys: string[];
  now: Date;
}

const ts = (d: Date) => Prisma.sql`${d.toISOString()}::timestamp`;

/** Podmínky WHERE kromě fulltextu (kategorie, cena, lokalita, parametry…). */
export function filterSql(p: SearchParams, o: FilterOptions): Prisma.Sql[] {
  const w: Prisma.Sql[] = [Prisma.sql`l."status" IN ('ACTIVE', 'RESERVED')`];
  if (p.sub) {
    w.push(Prisma.sql`c."slug" = ${p.sub}::text`);
    if (p.category) w.push(Prisma.sql`pc."slug" = ${p.category}::text`);
  } else if (p.category) w.push(Prisma.sql`((c."slug" = ${p.category}::text AND c."parentId" IS NULL) OR pc."slug" = ${p.category}::text)`);
  if (p.priceMin != null && Number.isFinite(Number(p.priceMin))) w.push(Prisma.sql`l."price" >= ${Math.round(Number(p.priceMin))}::int`);
  if (p.priceMax != null && Number.isFinite(Number(p.priceMax))) w.push(Prisma.sql`l."price" <= ${Math.round(Number(p.priceMax))}::int`);
  const radius = Math.min(MAX_RADIUS_KM, Math.max(0, Number(p.radius) || 0));
  const cityMatch = o.cityKey ? Prisma.sql`${sqlNorm(Prisma.sql`l."city"`)} = ${o.cityKey}::text` : undefined;
  if (o.geo && radius > 0) {
    const b = boundingBox(o.geo, radius);
    const inCircle = Prisma.sql`(l."lat" BETWEEN ${b.minLat}::float8 AND ${b.maxLat}::float8 AND l."lng" BETWEEN ${b.minLng}::float8 AND ${b.maxLng}::float8 AND ${distanceSql(o.geo)} <= ${radius}::float8)`;
    w.push(cityMatch ? Prisma.sql`(${inCircle} OR ${cityMatch})` : inCircle);
  } else if (cityMatch) w.push(cityMatch);
  if (p.region) w.push(Prisma.sql`l."region" = ${p.region}::text`);
  if (p.condition?.length) w.push(Prisma.sql`l."condition"::text IN (${Prisma.join(p.condition.map((c) => Prisma.sql`${c}::text`))})`);
  if (p.offerType) w.push(Prisma.sql`l."offerType"::text = ${p.offerType}::text`);
  if (p.verified) w.push(Prisma.sql`u."phoneVerifiedAt" IS NOT NULL`);
  if (p.sellerType) w.push(p.sellerType === 'business' ? Prisma.sql`u."isBusiness" = true` : Prisma.sql`u."isBusiness" = false`);
  const since = o.publishedAfter ?? (p.since && SINCE_MS[p.since] ? new Date(o.now.getTime() - SINCE_MS[p.since]) : undefined);
  if (since) w.push(Prisma.sql`l."publishedAt" > ${ts(since)}`);
  for (const [k, v] of Object.entries(p.attrs ?? {})) {
    if (!o.attrKeys.includes(k)) continue;
    const a = Prisma.sql`(l."attributes" -> ${k}::text)`;
    if (Array.isArray(v)) { if (v.length) w.push(Prisma.sql`(${Prisma.join(v.map((x) => Prisma.sql`${a} ? ${String(x)}::text`), ' OR ')})`); }
    else if (typeof v === 'boolean') { if (v) w.push(Prisma.sql`${a} = 'true'::jsonb`); }
    else if (typeof v === 'object' && v) {
      const num = Prisma.sql`(CASE WHEN jsonb_typeof(${a}) = 'number' THEN (l."attributes" ->> ${k}::text)::numeric END)`;
      if (v.min != null && Number.isFinite(Number(v.min))) w.push(Prisma.sql`${num} >= ${Number(v.min)}::numeric`);
      if (v.max != null && Number.isFinite(Number(v.max))) w.push(Prisma.sql`${num} <= ${Number(v.max)}::numeric`);
    } else if (typeof v === 'string' && v) w.push(Prisma.sql`${a} ? ${v}::text`);
  }
  return w;
}

/** Aktivní topování (2) nebo zvýraznění (1) – jen nevypršelé. */
export function promoSql(now: Date): Prisma.Sql {
  return Prisma.sql`(CASE WHEN l."topUntil" > ${ts(now)} THEN 2 WHEN l."highlightedUntil" > ${ts(now)} THEN 1 ELSE 0 END)`;
}

/** Kvalita shody: 3 = celá fráze v názvu, 2 = všechna slova v názvu, 1 = shoda v popisu/parametrech/městě. */
export function tierSql(terms: Term[], phrase: string): Prisma.Sql {
  return Prisma.sql`(CASE WHEN ${wordPrefix(NORM_TITLE, phrase)} THEN 3 WHEN ${termsMatch(NORM_TITLE, terms)} THEN 2 ELSE 1 END)`;
}

/** Skóre podobnosti pro výsledky s opravou překlepů. */
export function fuzzyScoreSql(terms: Term[], phrase: string): Prisma.Sql {
  return Prisma.sql`(word_similarity(${phrase}::text, ${NORM_TITLE}) * 2 + ${Prisma.join(terms.map((t) => Prisma.sql`word_similarity(${t.word}::text, l."searchText")`), ' + ')})`;
}

export type Sort = NonNullable<SearchParams['sort']>;

/** ORDER BY podle zvoleného řazení. Vždy končí na id, aby stránkování bylo stabilní. */
export function orderSql(sort: Sort | undefined, o: { now: Date; geo?: Geo; quality?: Prisma.Sql }): Prisma.Sql {
  const date = Prisma.sql`l."publishedAt" DESC NULLS LAST, l."id" DESC`;
  switch (sort) {
    case 'price_asc': return Prisma.sql`l."price" ASC NULLS LAST, l."id" ASC`;
    case 'price_desc': return Prisma.sql`l."price" DESC NULLS LAST, l."id" DESC`;
    case 'newest': return date;
    case 'distance': if (o.geo) return Prisma.sql`${distanceSql(o.geo)} ASC NULLS LAST, ${date}`;
    // falls through – bez polohy řadíme podle relevance
    default: {
      const rel = Prisma.sql`${promoSql(o.now)} DESC, COALESCE(l."bumpedAt", l."publishedAt", l."createdAt") DESC, l."id" DESC`;
      return o.quality ? Prisma.sql`${o.quality} DESC, ${rel}` : rel;
    }
  }
}

export const FROM_SQL = Prisma.sql`FROM "Listing" l JOIN "Category" c ON c."id" = l."categoryId" LEFT JOIN "Category" pc ON pc."id" = c."parentId" JOIN "User" u ON u."id" = l."userId"`;

/** Doplnění searchText u řádků, kde chybí (seed, starší data) – stejná normalizace jako v aplikaci. */
export function backfillSearchTextSql(onlyEmpty = true): Prisma.Sql {
  const src = Prisma.sql`concat_ws(' ', l."title", l."description", (SELECT string_agg(e.v, ' ') FROM (SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(x.value) = 'array' THEN x.value ELSE jsonb_build_array(x.value) END) AS v FROM jsonb_each(CASE WHEN jsonb_typeof(l."attributes") = 'object' THEN l."attributes" ELSE '{}'::jsonb END) x WHERE jsonb_typeof(x.value) IN ('string', 'number', 'array')) e), l."city")`;
  return Prisma.sql`UPDATE "Listing" l SET "searchText" = left(${sqlNorm(src)}, 12000) ${onlyEmpty ? Prisma.sql`WHERE l."searchText" = ''` : Prisma.empty}`;
}
