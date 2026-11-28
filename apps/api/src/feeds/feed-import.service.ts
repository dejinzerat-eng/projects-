import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ListingStatus, PartnerFeed, Prisma } from '@prisma/client';
import { buildSearchText, effectiveFilters, slugify, type FilterDef } from '@dej/shared';
import { municipalityByZip, resolveLocation } from '@dej/shared/dist/municipalities';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { gunzipSync } from 'zlib';
import { ListingPolicyService } from '../admin/listing-policy.service';
import { PrismaService } from '../common/prisma.service';
import { joinLegacyHash, splitLegacyHash, writtenHash } from '../legacy/legacy-map';
import { contentHash } from '../listings/duplicates';
import { REVIEW_SCORE } from '../listings/lifecycle';
import { assessListingDetailed } from '../listings/moderation';
import { priceInCzk } from '../listings/price';
import { imageHash } from '../media/image-hash';
import { StorageService } from '../media/storage.service';
import { SearchService } from '../search/search.service';
import { itemHash, mapItem, normalizeAttrs, suggestCategory, suggestFieldMap, type CatRef, type FeedItem, type FieldMap } from './feed-map';
import { decodeXml, FeedParseError, parseFeed, type FeedFormat, type FieldInfo } from './feed-parse';
import { FEED_MAX_BYTES, fetchLimited, IMAGE_MAX_BYTES } from './feed-source';

/** Jedna dávka smí běžet nejvýše tolik (funkce na Vercelu má limit 60 s, stažení feedu zabere taky chvíli). */
export const FEED_BATCH_MS = Number(process.env.FEED_BATCH_MS) || 30_000;
const VISIBLE: ListingStatus[] = ['ACTIVE', 'PENDING', 'RESERVED'];
/** Stavy, ve kterých import inzerát aktualizuje (zamítnutý, smazaný a prodaný nechá být). */
const UPDATABLE: ListingStatus[] = ['ACTIVE', 'PENDING', 'RESERVED', 'EXPIRED'];
/** Pod tento podíl dosud zveřejněných nabídek se nic automaticky nestahuje (rozbitý nebo zkrácený feed). */
const SAFE_REMOVE_RATIO = 0.5;

/** Nastavení feedu, se kterými se čte (uložená, nebo rozpracovaná v administraci pro náhled). */
export interface FeedSettings {
  url: string; format: string; fieldMap: FieldMap; categoryMap: Record<string, string>; defaultCategoryId: string | null;
  defaultCity: string | null; defaultZip: string | null; maxItems: number; requireApproval: boolean;
}
type Cat = CatRef & { label: string; filters: FilterDef[] };
export type ItemAction = 'new' | 'changed' | 'unchanged' | 'edited' | 'blocked';
export type ImportResult = 'created' | 'updated' | 'unchanged' | 'edited' | 'blocked' | 'error';
interface Existing { id: string; feedItemId: string | null; feedHash: string | null; status: ListingStatus; title: string; description: string; price: number | null; categoryId: string; expiresAt: Date | null }
interface Problem { id: string; title?: string; message: string }

export function asFieldMap(v: unknown): FieldMap {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const out: FieldMap = {};
  for (const [k, x] of Object.entries(v)) if (Array.isArray(x)) (out as Record<string, string[]>)[k] = x.filter((p): p is string => typeof p === 'string').slice(0, 10);
  return out;
}
export function asCategoryMap(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string>;
}
export const settingsOf = (f: PartnerFeed): FeedSettings => ({
  url: f.url, format: f.format, fieldMap: asFieldMap(f.fieldMap), categoryMap: asCategoryMap(f.categoryMap), defaultCategoryId: f.defaultCategoryId,
  defaultCity: f.defaultCity, defaultZip: f.defaultZip, maxItems: f.maxItems, requireApproval: f.requireApproval,
});
const shortHash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 12);

/**
 * Bezplatný import nabídek partnerů (autobazary, realitní kanceláře, e-shopy) z XML feedu.
 * Opakovatelný: inzerát je svázaný s položkou feedu (feedId + feedItemId), nic se nezdvojí. Změny ve feedu se přenesou,
 * úpravy v našem systému (moderátor, partner) se nepřepíšou, nabídky, které z feedu zmizely, se stáhnou (stav „vypršelý“).
 */
@Injectable()
export class FeedImportService {
  private log = new Logger('FeedImport');

  constructor(private prisma: PrismaService, private storage: StorageService, private search: SearchService, private policy: ListingPolicyService) {}

  /** Podkategorie s filtry (parametry) – cíl přiřazení. */
  async categories(): Promise<Cat[]> {
    const rows = await this.prisma.category.findMany({ where: { parentId: { not: null }, active: true }, include: { parent: true }, orderBy: [{ parent: { position: 'asc' } }, { position: 'asc' }] });
    return rows.filter((c) => c.parent?.active !== false).map((c) => ({
      id: c.id, slug: c.slug, name: c.name, parentSlug: c.parent!.slug, parentName: c.parent!.name, label: `${c.parent!.name} › ${c.name}`,
      filters: effectiveFilters(c.parent!.slug, c.parent!.filters, c.slug, c.filters),
    }));
  }

  /** Stáhne a přečte feed. Vrací položky převedené na data inzerátu, přehled polí a chyby jednotlivých položek. */
  async load(s: FeedSettings) {
    const got = await fetchLimited(s.url, { maxBytes: FEED_MAX_BYTES, timeoutMs: 25_000, accept: 'application/xml, text/xml, */*' }).catch((e: Error) => { throw new FeedParseError(`Feed nejde stáhnout: ${e.message}`); });
    let buf = got.buf;
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      try { buf = gunzipSync(buf, { maxOutputLength: FEED_MAX_BYTES * 4 }); } catch { throw new FeedParseError('Feed je komprimovaný (gzip), ale nejde rozbalit nebo je po rozbalení příliš velký.'); }
    }
    const parsed = parseFeed(decodeXml(buf), Math.max(1, s.maxItems));
    const detected = parsed.format;
    const format = (['heureka', 'google', 'generic'].includes(s.format) ? s.format : detected) as FeedFormat;
    const map = suggestFieldMap(format, parsed.fields, s.fieldMap);
    const items: FeedItem[] = [];
    const errors: Problem[] = [];
    const seen = new Set<string>();
    let duplicates = 0;
    parsed.items.forEach((raw, i) => {
      const r = mapItem(raw, map, got.url);
      if (!r.item) { errors.push({ id: `#${i + 1}`, message: r.error ?? 'Položku nejde použít.' }); return; }
      if (seen.has(r.item.id)) { duplicates++; return; }
      seen.add(r.item.id);
      items.push(r.item);
    });
    return { format, detected, itemTag: parsed.itemTag, total: parsed.total, limited: parsed.total > parsed.items.length, fields: parsed.fields.slice(0, 200) as FieldInfo[], map, items, errors, duplicates };
  }

  /** Cílová kategorie položky: ruční přiřazení › odhad › výchozí kategorie feedu › Ostatní › Různé. */
  category(s: FeedSettings, item: FeedItem, cats: Cat[]): { cat: Cat; source: 'map' | 'auto' | 'default' | 'fallback' } {
    const byId = (id: string | null | undefined) => (id ? cats.find((c) => c.id === id) : undefined);
    const mapped = byId(s.categoryMap[item.category]);
    if (mapped) return { cat: mapped, source: 'map' };
    const guess = item.category || Object.keys(item.attrs).length ? suggestCategory(item.category, cats, { offer: item.offer, attrs: item.attrs }) : null;
    if (guess) return { cat: cats.find((c) => c.id === guess.id)!, source: 'auto' };
    const def = byId(s.defaultCategoryId);
    if (def) return { cat: def, source: 'default' };
    const fallback = cats.find((c) => c.parentSlug === 'ostatni' && c.slug === 'ruzne') ?? cats[0];
    if (!fallback) throw new Error('V databázi chybí kategorie (spusťte seed).');
    return { cat: fallback, source: 'fallback' };
  }

  /** Data inzerátu z položky feedu (bez zápisu). */
  prepare(s: FeedSettings, item: FeedItem, cats: Cat[], eurRate: number) {
    const { cat, source } = this.category(s, item, cats);
    const loc = (() => {
      const city = item.city || (!item.zip ? s.defaultCity ?? '' : '');
      const zip = item.zip ?? (item.city ? null : s.defaultZip);
      if (!city && zip) { const m = municipalityByZip(zip); if (m) return { city: m.name, region: m.region, zip, lat: m.lat, lng: m.lng }; }
      if (!city) return { city: 'Celá ČR', region: '', zip: null, lat: null, lng: null };
      const r = resolveLocation(city, zip);
      return { city: r.city.slice(0, 80), region: r.region, zip: r.zip, lat: r.lat, lng: r.lng };
    })();
    const risk = assessListingDetailed({ title: item.title, description: item.description, price: item.price, categorySlug: cat.parentSlug });
    const reasons = risk.reasons.length ? [...risk.reasons.slice(0, -1), `${risk.reasons.at(-1)}${risk.labels.length ? ` (${risk.labels.join(', ')})` : ''}`] : [];
    const attributes = normalizeAttrs(item, cat.filters);
    return {
      cat, catSource: source, loc, attributes, risk: { score: risk.score, reasons },
      data: {
        slug: slugify(item.title) || 'inzerat', title: item.title, description: item.description, price: item.price, priceCzk: priceInCzk(item.price, item.currency, eurRate),
        priceNegotiable: item.price == null, currency: item.currency, condition: item.condition, offerType: item.offer === 'RENT' ? 'RENT' as const : 'SELL' as const,
        categoryId: cat.id, city: loc.city, region: loc.region, zip: loc.zip, lat: loc.lat, lng: loc.lng, attributes: attributes as Prisma.InputJsonValue,
        searchText: buildSearchText({ title: item.title, description: item.description, attributes, city: loc.city }),
        spamScore: risk.score, riskReasons: reasons as Prisma.InputJsonValue, contentHash: contentHash(item.title, item.description), sourceUrl: item.url,
      },
    };
  }

  private async existing(feedId: string): Promise<Map<string, Existing>> {
    const rows = await this.prisma.listing.findMany({ where: { feedId }, select: { id: true, feedItemId: true, feedHash: true, status: true, title: true, description: true, price: true, categoryId: true, expiresAt: true } });
    return new Map(rows.filter((r) => r.feedItemId).map((r) => [r.feedItemId!, r]));
  }

  private action(ex: Existing | undefined, item: FeedItem): ItemAction {
    if (!ex) return 'new';
    if (!UPDATABLE.includes(ex.status)) return 'blocked';
    const prev = splitLegacyHash(ex.feedHash);
    if (prev.source === itemHash(item) && ex.status !== 'EXPIRED') return 'unchanged';
    if (writtenHash(ex) !== prev.written) return 'edited';
    return 'changed';
  }

  /** Náhled: co ve feedu je a co se s tím při synchronizaci stane. Nic nezapisuje. */
  async preview(s: FeedSettings, feedId?: string) {
    const loaded = await this.load(s);
    const [cats, eurRate, existing] = await Promise.all([this.categories(), this.policy.eurRate(), feedId ? this.existing(feedId) : Promise.resolve(new Map<string, Existing>())]);
    const categories = new Map<string, { text: string; count: number; categoryId: string; label: string; source: string }>();
    const counts = { new: 0, changed: 0, unchanged: 0, edited: 0, blocked: 0, review: 0 };
    const rows = loaded.items.map((item) => {
      const p = this.prepare(s, item, cats, eurRate);
      const action = this.action(existing.get(item.id), item);
      counts[action]++;
      const pending = action === 'new' && (s.requireApproval || p.risk.score >= REVIEW_SCORE);
      if (pending) counts.review++;
      const c = categories.get(item.category) ?? { text: item.category, count: 0, categoryId: p.cat.id, label: p.cat.label, source: p.catSource };
      c.count++;
      categories.set(item.category, c);
      return {
        id: item.id, title: item.title, category: item.category, newCategory: p.cat.label, catSource: p.catSource, price: item.price, currency: item.currency,
        place: p.loc.city, images: item.images.length, firstImage: item.images[0] ?? null, url: item.url, attributes: p.attributes, condition: item.condition,
        action, pending, risk: p.risk.reasons, listingId: existing.get(item.id)?.id,
      };
    });
    const ids = new Set(loaded.items.map((i) => i.id));
    const missing = [...existing.values()].filter((e) => !ids.has(e.feedItemId!) && VISIBLE.includes(e.status)).length;
    return {
      format: loaded.format, detected: loaded.detected, itemTag: loaded.itemTag, total: loaded.total, used: loaded.items.length, limited: loaded.limited,
      fields: loaded.fields, fieldMap: loaded.map, duplicates: loaded.duplicates, errors: loaded.errors.slice(0, 50), errorCount: loaded.errors.length,
      counts: { ...counts, missing: loaded.limited ? 0 : missing },
      categories: [...categories.values()].sort((a, b) => b.count - a.count).slice(0, 300),
      items: rows.slice(0, 200),
    };
  }

  /**
   * Jedna dávka synchronizace. Pokračuje rozpracovaný běh (feed.currentRunId), jinak začne nový.
   * Zpracuje nové a změněné položky, dokud nevyprší čas; po poslední dávce stáhne nabídky, které z feedu zmizely.
   */
  async sync(feedId: string, trigger: 'manual' | 'schedule', opts: { actorId?: string; budgetMs?: number; skip?: string[] } = {}) {
    const started = Date.now();
    const budget = opts.budgetMs ?? FEED_BATCH_MS;
    const feed = await this.prisma.partnerFeed.findUnique({ where: { id: feedId }, include: { user: { select: { status: true } } } });
    if (!feed) throw new NotFoundException('Partner neexistuje.');
    let run = feed.currentRunId ? await this.prisma.partnerFeedRun.findFirst({ where: { id: feed.currentRunId, feedId, status: 'running' } }) : null;
    if (!run) {
      run = await this.prisma.partnerFeedRun.create({ data: { feedId, trigger } });
      await this.prisma.partnerFeed.update({ where: { id: feedId }, data: { currentRunId: run.id } });
    }
    const problems: Problem[] = Array.isArray(run.problems) ? (run.problems as unknown as Problem[]) : [];
    const finish = async (status: 'ok' | 'partial' | 'error', message: string | null, extra: Prisma.PartnerFeedRunUpdateInput = {}) => {
      const now = new Date();
      const done = await this.prisma.partnerFeedRun.update({ where: { id: run!.id }, data: { status, message, finishedAt: now, problems: problems.slice(0, 50) as unknown as Prisma.InputJsonValue, ...extra } });
      await this.prisma.partnerFeed.update({
        where: { id: feedId },
        data: { currentRunId: null, lastSyncAt: now, lastStatus: status, lastMessage: message, nextSyncAt: feed.intervalHours > 0 ? new Date(now.getTime() + feed.intervalHours * 3600_000 - 15 * 60_000) : null },
      });
      if (opts.actorId) await this.prisma.auditLog.create({ data: { actorId: opts.actorId, action: 'feed.sync', targetType: 'feed', targetId: feedId, meta: { run: run!.id, status, created: done.created, updated: done.updated, removed: done.removed, errors: done.errors } } });
      return done;
    };

    if (feed.user.status === 'BLOCKED') {
      const r = await finish('error', 'Účet partnera je zablokovaný – synchronizace neproběhla.');
      return { runId: r.id, done: true, run: r, remaining: 0 };
    }
    let loaded: Awaited<ReturnType<FeedImportService['load']>>;
    try { loaded = await this.load(settingsOf(feed)); } catch (e) {
      const r = await finish('error', (e as Error).message);
      return { runId: r.id, done: true, run: r, remaining: 0 };
    }
    const s = settingsOf(feed);
    const [cats, eurRate, days, existing] = await Promise.all([this.categories(), this.policy.eurRate(), this.policy.listingDays(), this.existing(feedId)]);
    const fresh = new Date(Date.now() + days * 864e5);
    const skip = new Set(opts.skip ?? []);
    // upravené a zamítnuté se jen poznamenají (verze feedu), aby se nehlásily při každé synchronizaci znovu
    const todo = loaded.items.filter((i) => !skip.has(i.id) && this.action(existing.get(i.id), i) !== 'unchanged');
    const counts = { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0 };
    let i = 0;
    for (; i < todo.length; i++) {
      if (i > 0 && Date.now() - started > budget) break;
      const item = todo[i];
      try {
        const r = await this.importOne(feed.id, feed.userId, s, item, existing.get(item.id), cats, eurRate, fresh);
        if (r === 'created') counts.created++; else if (r === 'updated') counts.updated++; else counts.skipped++;
      } catch (e) {
        counts.errors++;
        this.log.warn(`Feed ${feed.name}, položka ${item.id}: ${(e as Error).message}`);
        if (problems.length < 50) problems.push({ id: item.id, title: item.title, message: (e as Error).message.slice(0, 300) });
      }
    }
    const remaining = todo.length - i;
    for (const e of loaded.errors) if (problems.length < 50 && !problems.some((p) => p.id === e.id)) problems.push(e);
    await this.prisma.partnerFeedRun.update({
      where: { id: run.id },
      data: {
        items: loaded.items.length, created: { increment: counts.created }, updated: { increment: counts.updated }, skipped: { increment: counts.skipped },
        errors: { increment: counts.errors }, problems: problems.slice(0, 50) as unknown as Prisma.InputJsonValue,
      },
    });
    if (remaining > 0) {
      const r = await this.prisma.partnerFeedRun.findUniqueOrThrow({ where: { id: run.id } });
      return { runId: run.id, done: false, run: r, remaining };
    }

    // Poslední dávka: prodloužit platnost nabídkám, které ve feedu zůstávají, a stáhnout ty, které zmizely
    const ids = new Set(loaded.items.map((x) => x.id));
    const stay = [...existing.values()].filter((e) => ids.has(e.feedItemId!) && ['ACTIVE', 'RESERVED'].includes(e.status) && (!e.expiresAt || e.expiresAt.getTime() < fresh.getTime() - days * 864e5 / 2));
    if (stay.length) await this.prisma.listing.updateMany({ where: { id: { in: stay.map((e) => e.id) } }, data: { expiresAt: fresh, expiryNotifiedAt: null } });
    const unchanged = loaded.items.length - todo.length;
    const visible = [...existing.values()].filter((e) => VISIBLE.includes(e.status));
    const missing = visible.filter((e) => !ids.has(e.feedItemId!));
    let removed = 0;
    let message: string | null = null;
    if (loaded.limited) message = `Feed má ${loaded.total} položek, importuje se jen prvních ${loaded.items.length} (limit partnera). Chybějící nabídky se proto nestahují.`;
    else if (missing.length && visible.length >= 10 && loaded.items.length < visible.length * SAFE_REMOVE_RATIO) {
      message = `Feed má výrazně méně nabídek (${loaded.items.length}) než je u nás zveřejněno (${visible.length}). Pro jistotu jsme nic nestáhli – zkontrolujte feed a stáhněte je ručně tlačítkem „Stáhnout chybějící“.`;
    } else if (missing.length) {
      removed = await this.expire(missing.map((m) => m.id));
    }
    const errors = (await this.prisma.partnerFeedRun.findUniqueOrThrow({ where: { id: run.id } })).errors + loaded.errors.length;
    const status = message ? 'partial' : errors ? 'partial' : 'ok';
    if (!message && errors) message = `${errors} položek se nepodařilo zpracovat.`;
    const r = await finish(status, message, { removed: { increment: removed }, unchanged });
    return { runId: run.id, done: true, run: r, remaining: 0 };
  }

  /** Nabídky, které z feedu zmizely: stav „vypršelý“ (když se do feedu vrátí, import je znovu zveřejní). */
  async expire(listingIds: string[]) {
    if (!listingIds.length) return 0;
    const r = await this.prisma.listing.updateMany({ where: { id: { in: listingIds }, status: { in: VISIBLE } }, data: { status: 'EXPIRED' } });
    for (const id of listingIds) await this.search.index(id);
    return r.count;
  }

  /** Ruční stažení chybějících nabídek (když automatika z opatrnosti nic nestáhla). */
  async expireMissing(feedId: string, actorId: string) {
    const feed = await this.prisma.partnerFeed.findUnique({ where: { id: feedId } });
    if (!feed) throw new NotFoundException('Partner neexistuje.');
    const loaded = await this.load(settingsOf(feed)).catch((e: Error) => { throw new BadRequestException(e.message); });
    if (loaded.limited) throw new BadRequestException('Feed je delší než limit partnera – nejde poznat, které nabídky opravdu chybí. Zvyšte limit položek.');
    const ids = new Set(loaded.items.map((x) => x.id));
    const existing = await this.existing(feedId);
    const missing = [...existing.values()].filter((e) => !ids.has(e.feedItemId!) && VISIBLE.includes(e.status)).map((e) => e.id);
    const n = await this.expire(missing);
    await this.prisma.auditLog.create({ data: { actorId, action: 'feed.expire_missing', targetType: 'feed', targetId: feedId, meta: { count: n } } });
    return { removed: n };
  }

  private async importOne(feedId: string, userId: string, s: FeedSettings, item: FeedItem, ex: Existing | undefined, cats: Cat[], eurRate: number, fresh: Date): Promise<ImportResult> {
    const p = this.prepare(s, item, cats, eurRate);
    const src = itemHash(item);
    const written = writtenHash({ title: p.data.title, description: p.data.description, price: p.data.price, categoryId: p.data.categoryId });
    const risky = p.risk.score >= REVIEW_SCORE;
    if (!ex) {
      const status: ListingStatus = s.requireApproval || risky ? 'PENDING' : 'ACTIVE';
      const listing = await this.prisma.listing.create({
        data: { ...p.data, userId, status, feedId, feedItemId: item.id, feedHash: joinLegacyHash(src, written), publishedAt: status === 'ACTIVE' ? new Date() : null, expiresAt: fresh },
      }).catch(async (e: Error) => {
        // souběžná dávka už položku založila (unikátní feedId + feedItemId) – nic nezdvojíme
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
        throw e;
      });
      if (!listing) return 'unchanged';
      await this.replaceImages(feedId, listing.id, userId, item, []);
      await this.search.index(listing.id);
      return 'created';
    }
    const action = this.action(ex, item);
    const prev = splitLegacyHash(ex.feedHash);
    if (action === 'blocked' || action === 'edited') {
      // Rozhodnutí moderátora a ruční úpravy zůstávají; zapamatujeme si verzi feedu, ať se to nehlásí znovu
      await this.prisma.listing.update({ where: { id: ex.id }, data: { feedHash: joinLegacyHash(src, prev.written ?? written) } });
      return action;
    }
    let status = ex.status;
    if (status === 'EXPIRED') status = risky ? 'PENDING' : 'ACTIVE';
    else if (['ACTIVE', 'RESERVED'].includes(status) && risky) status = 'PENDING';
    const reopened = ex.status === 'EXPIRED' && status === 'ACTIVE';
    const listing = await this.prisma.listing.update({
      where: { id: ex.id },
      data: { ...p.data, status, feedHash: joinLegacyHash(src, written), ...(['ACTIVE', 'RESERVED', 'PENDING'].includes(status) ? { expiresAt: fresh, expiryNotifiedAt: null } : {}), ...(reopened ? { publishedAt: new Date() } : {}) },
      include: { images: { select: { url: true, thumbUrl: true } } },
    });
    await this.replaceImages(feedId, listing.id, userId, item, listing.images);
    await this.search.index(listing.id);
    return 'updated';
  }

  /** Fotky: stáhnout, zmenšit (1600 px + náhled) a uložit k nám. Když se seznam fotek ve feedu nezměnil, nic se nestahuje. */
  private async replaceImages(feedId: string, listingId: string, ownerId: string, item: FeedItem, current: { url: string; thumbUrl: string }[]) {
    const key = shortHash(item.id);
    const names = item.images.map((u) => shortHash(u));
    const same = current.length === names.length && names.every((n, i) => current[i]?.url.includes(`/${n}`));
    if (same) return;
    const rows: Prisma.ListingImageCreateManyInput[] = [];
    for (let i = 0; i < item.images.length; i += 4) {
      await Promise.all(item.images.slice(i, i + 4).map(async (src, k) => {
        const position = i + k;
        try {
          const got = await fetchLimited(src, { maxBytes: IMAGE_MAX_BYTES, timeoutMs: 15_000, accept: 'image/*' });
          const img = sharp(got.buf, { failOn: 'error' }).rotate();
          const [large, thumb, phash] = await Promise.all([
            img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
            img.clone().resize({ width: 640, height: 480, fit: 'cover' }).webp({ quality: 76 }).toBuffer(),
            imageHash(img).catch(() => null),
          ]);
          const prefix = `feeds/${feedId}/${key}/${names[position]}`;
          const [url, thumbUrl] = await Promise.all([this.storage.put(`${prefix}.webp`, large.data, 'image/webp'), this.storage.put(`${prefix}_t.webp`, thumb, 'image/webp')]);
          rows.push({ listingId, ownerId, url, thumbUrl, width: large.info.width, height: large.info.height, position, phash });
        } catch (e) { this.log.warn(`Fotka ${src}: ${(e as Error).message}`); }
      }));
    }
    // Když se nepodařilo stáhnout nic, staré fotky necháme (výpadek serveru partnera)
    if (!rows.length && item.images.length && current.length) return;
    await this.prisma.listingImage.deleteMany({ where: { listingId } });
    await this.storage.deleteMany(current.flatMap((c) => [c.url, c.thumbUrl]));
    if (rows.length) await this.prisma.listingImage.createMany({ data: rows.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) });
  }

  /** Schválí všechny čekající inzeráty partnera (po kontrole náhledu). */
  async approvePending(feedId: string, actorId: string) {
    const rows = await this.prisma.listing.findMany({ where: { feedId, status: 'PENDING' }, select: { id: true, publishedAt: true } });
    const expiresAt = await this.policy.expiresAt();
    for (const r of rows) {
      await this.prisma.listing.update({ where: { id: r.id }, data: { status: 'ACTIVE', rejectReason: null, publishedAt: r.publishedAt ?? new Date(), expiresAt, expiryNotifiedAt: null } });
      await this.search.index(r.id);
    }
    await this.prisma.auditLog.create({ data: { actorId, action: 'feed.approve_pending', targetType: 'feed', targetId: feedId, meta: { count: rows.length } } });
    return { approved: rows.length };
  }

  /** Automatická synchronizace (pravidelná úloha): feedy, kterým uplynul interval, a rozpracované běhy. */
  async syncDue(budgetMs = 35_000, now = new Date()) {
    const started = Date.now();
    const due = await this.prisma.partnerFeed.findMany({
      where: { active: true, OR: [{ currentRunId: { not: null } }, { intervalHours: { gt: 0 }, OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }] }] },
      orderBy: [{ nextSyncAt: { sort: 'asc', nulls: 'first' } }], take: 20, select: { id: true, name: true },
    });
    const done: string[] = [];
    for (const f of due) {
      const left = budgetMs - (Date.now() - started);
      if (left < 5_000) break;
      try { await this.sync(f.id, 'schedule', { budgetMs: Math.min(left - 3_000, FEED_BATCH_MS) }); done.push(f.name); } catch (e) { this.log.error(`Feed ${f.name}: ${(e as Error).message}`); }
    }
    if (done.length) this.log.log(`Synchronizace feedů: ${done.join(', ')}`);
    return done;
  }
}
