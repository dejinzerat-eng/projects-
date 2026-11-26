import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { buildSearchText, can, cleanParams, effectiveFilters, type FilterDef, findCity, parseVideoUrl, slugify, VIDEO_URL_ERROR } from '@dej/shared';
import { resolveLocation } from '@dej/shared/dist/municipalities';
import { z } from 'zod';
import { AuthUser } from '../common/auth.guard';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { LISTING_INCLUDE, SearchService } from '../search/search.service';
import { ZodPipe } from '../common/zod';
import { contentHash, isWeakHash, normalizeText, PHASH_MAX_DISTANCE } from './duplicates';
import { nextExpiry, nextStatus, REVIEW_SCORE } from './lifecycle';
import { assessListing } from './moderation';
import { priceInCzk } from './price';
import { isPriceAnomaly, LOW_PRICE_REASON, pickPriceStats, PRICE_ANOMALY_MIN_SAMPLE, PRICE_ANOMALY_SCORE, PRICED_OFFER_TYPES, type PriceStats } from './price-anomaly';
import { canRevealPhone } from '../users/phone-privacy';

const VideoUrl = z.string().trim().max(500)
  .refine((u) => !u || !!parseVideoUrl(u), { message: VIDEO_URL_ERROR })
  .transform((u) => (u ? parseVideoUrl(u)!.url : ''));
import { ListingPolicyService } from '../admin/listing-policy.service';

export const ListingDto = z.object({
  title: z.string({ error: 'Napište název inzerátu.' }).trim().min(5, 'Název musí mít alespoň 5 znaků.').max(90, 'Název může mít nejvýše 90 znaků.'),
  description: z.string({ error: 'Napište popis inzerátu.' }).trim().min(10, 'Popis musí mít alespoň 10 znaků.').max(8000, 'Popis může mít nejvýše 8000 znaků.'),
  price: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
  priceNegotiable: z.boolean().default(false),
  currency: z.enum(['CZK', 'EUR']).default('CZK'),
  categorySlug: z.string({ error: 'Vyberte kategorii.' }).min(1, 'Vyberte kategorii.'),
  subSlug: z.string({ error: 'Vyberte podkategorii.' }).min(1, 'Vyberte podkategorii.'),
  condition: z.enum(['NEW', 'LIKE_NEW', 'USED', 'DAMAGED']).nullable().optional(),
  offerType: z.enum(['SELL', 'BUY', 'EXCHANGE', 'GIVE', 'RENT']).default('SELL'),
  city: z.string({ error: 'Zadejte lokalitu.' }).trim().min(2, 'Zadejte lokalitu.').max(80),
  zip: z.string().regex(/^\d{3}\s?\d{2}$/, 'PSČ má 5 číslic.').optional().or(z.literal('')),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])).default({}),
  imageIds: z.array(z.string()).max(20, 'Nejvýše 20 fotografií.').default([]),
  videoUrl: VideoUrl.optional(),
  publish: z.boolean().default(true),
  /** Jak dlouho trvalo vyplnění průvodce (ms) – měření cíle „inzerát do 60 sekund“ */
  composeMs: z.number().int().min(0).optional(),
});
export type ListingInput = z.infer<typeof ListingDto>;

/** Koncept: stačí název a kategorie, ostatní se doplní před zveřejněním. */
export const ListingDraftDto = ListingDto.extend({
  title: z.string({ error: 'Pro uložení konceptu napište název.' }).trim().min(1, 'Pro uložení konceptu napište název.').max(90, 'Název může mít nejvýše 90 znaků.'),
  description: z.string().trim().max(8000, 'Popis může mít nejvýše 8000 znaků.').default(''),
  categorySlug: z.string({ error: 'Pro uložení konceptu vyberte kategorii.' }).min(1, 'Pro uložení konceptu vyberte kategorii.'),
  subSlug: z.string({ error: 'Pro uložení konceptu vyberte podkategorii.' }).min(1, 'Pro uložení konceptu vyberte podkategorii.'),
  city: z.string().trim().max(80).default(''),
  // Neúplné PSČ v konceptu nevadí – uložíme jen platné, jinak ho vynecháme
  zip: z.string().trim().max(10).optional().transform((z) => (z && /^\d{3}\s?\d{2}$/.test(z) ? z : undefined)),
  publish: z.literal(false),
});

/** Validace těla podle toho, jestli jde o koncept (publish: false), nebo o zveřejnění. */
export function parseListingBody(body: unknown): ListingInput {
  const draft = !!body && typeof body === 'object' && (body as { publish?: unknown }).publish === false;
  return new ZodPipe<ListingInput>((draft ? ListingDraftDto : ListingDto) as z.ZodType<ListingInput>).transform(body);
}

const DUP_STATUSES: ListingStatus[] = ['ACTIVE', 'PENDING', 'RESERVED'];

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService, private search: SearchService, private redis: RedisService, private policy: ListingPolicyService) {}

  /** Jen aktivní podkategorie aktivní hlavní kategorie; parametry podle definic v databázi. */
  private async resolveCategory(categorySlug: string, subSlug: string) {
    const cat = await this.prisma.category.findFirst({ where: { slug: subSlug, active: true, parent: { slug: categorySlug, active: true, parentId: null } }, include: { parent: true } });
    if (!cat) throw new BadRequestException({ message: 'Vybraná kategorie neexistuje nebo už není v nabídce. Vyberte prosím jinou.', field: 'subSlug' });
    return { ...cat, defs: effectiveFilters(categorySlug, cat.parent?.filters, subSlug, cat.filters) };
  }

  private cleanAttributes(defs: FilterDef[], attrs: ListingInput['attributes'], strict: boolean) {
    const r = cleanParams(defs, attrs, strict);
    if (r.error) throw new BadRequestException({ message: r.error, field: 'attributes' });
    return r.values;
  }

  private async checkSpam(userId: string) {
    const n = await this.redis.incr(`newlisting:${userId}`, 3600);
    const max = await this.policy.maxPerHour();
    if (n > max) throw new BadRequestException(`Za hodinu lze vložit nejvýše ${max} inzerátů.`);
  }

  /** Nezveřejněný koncept smí být neúplný; zveřejněný inzerát musí projít plnou kontrolou. */
  private requireComplete(dto: ListingInput): ListingInput {
    const r = ListingDto.safeParse({ ...dto, publish: true });
    if (!r.success) {
      const issue = r.error.issues[0];
      throw new BadRequestException({ message: issue?.message ?? 'Neplatná data', field: issue?.path.join('.') });
    }
    return { ...r.data, publish: dto.publish };
  }

  /**
   * Kontrola duplicit. Stejný text u vlastního aktivního inzerátu zablokuje, shoda s cizím inzerátem
   * (text nebo znovu použitá fotka) pošle inzerát ke schválení. U cizích inzerátů porovnáváme jen se staršími
   * (`before` = vznik posuzovaného inzerátu), aby původního autora nepotrestal ten, kdo od něj text či fotky zkopíroval.
   */
  private async findDuplicates(ownerId: string, listingId: string | null, before: Date, title: string, description: string, imageIds: string[]) {
    const hash = contentHash(title, description);
    const norm = `${normalizeText(title)}\n${normalizeText(description)}`;
    const notSelf = listingId ? { id: { not: listingId } } : {};
    const candidates = await this.prisma.listing.findMany({
      where: { ...notSelf, status: { in: DUP_STATUSES }, OR: [{ contentHash: hash }, { contentHash: null, title: { equals: title, mode: 'insensitive' } }] },
      select: { id: true, slug: true, title: true, description: true, userId: true, contentHash: true, createdAt: true }, take: 20,
    });
    const same = candidates.filter((c) => c.contentHash === hash || `${normalizeText(c.title)}\n${normalizeText(c.description)}` === norm);
    const own = same.find((c) => c.userId === ownerId) ?? null;
    // U velmi krátkých textů může jít o náhodu – cizí shodu hlásíme jen u popisu s nějakým obsahem
    const otherText = normalizeText(description).length >= 30 && same.some((c) => c.userId !== ownerId && c.createdAt < before);

    let otherPhoto = false;
    if (imageIds.length) {
      const imgs = await this.prisma.listingImage.findMany({ where: { id: { in: imageIds }, ownerId, phash: { not: null } }, select: { phash: true } });
      const hashes = imgs.map((i) => i.phash!).filter((h) => !isWeakHash(h));
      if (hashes.length) {
        const rows = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT li.id FROM "ListingImage" li
          JOIN "Listing" l ON l.id = li."listingId"
          JOIN unnest(${hashes}::bigint[]) AS h(v) ON length(replace(((li.phash # h.v)::bit(64))::text, '0', '')) <= ${PHASH_MAX_DISTANCE}
          WHERE li.phash IS NOT NULL AND li."ownerId" <> ${ownerId} AND l."userId" <> ${ownerId}
            AND l.status IN ('ACTIVE', 'RESERVED', 'PENDING') AND l."createdAt" < ${before}
          LIMIT 1`;
        otherPhoto = rows.length > 0;
      }
    }
    return { hash, own, otherText, otherPhoto };
  }

  /** Medián ceny aktivních inzerátů (podkategorie / celá hlavní kategorie) se stejným typem nabídky a měnou, cache 1 h. */
  private async priceStats(scope: 'sub' | 'parent', categoryId: string, offerType: string, currency: string): Promise<PriceStats> {
    const key = `pricemed:v1:${scope}:${categoryId}:${offerType}:${currency}`;
    const cached = await this.redis.get(key).catch(() => null);
    if (cached) { try { return JSON.parse(cached) as PriceStats; } catch { /* poškozená cache */ } }
    const cat = scope === 'sub' ? Prisma.sql`l."categoryId" = ${categoryId}` : Prisma.sql`l."categoryId" IN (SELECT id FROM "Category" WHERE "parentId" = ${categoryId})`;
    const [r] = await this.prisma.$queryRaw<{ median: number | null; n: number }[]>`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price)::float AS median, COUNT(*)::int AS n FROM "Listing" l
      WHERE ${cat} AND l.status = 'ACTIVE' AND l.price > 0 AND l."offerType"::text = ${offerType} AND l.currency = ${currency}`;
    const stats = { median: r?.median ?? null, sample: r?.n ?? 0 };
    await this.redis.set(key, JSON.stringify(stats), 3600).catch(() => undefined);
    return stats;
  }

  /** Podezřele nízká cena vůči mediánu kategorie (viz price-anomaly.ts). Výpadek dotazu inzerát neblokuje. */
  private async lowPrice(dto: ListingInput, cat: { id: string; parentId: string | null }) {
    if (dto.price == null || dto.price <= 0 || !PRICED_OFFER_TYPES.includes(dto.offerType)) return false;
    try {
      const sub = await this.priceStats('sub', cat.id, dto.offerType, dto.currency);
      const parent = sub.sample >= PRICE_ANOMALY_MIN_SAMPLE || !cat.parentId ? null : await this.priceStats('parent', cat.parentId, dto.offerType, dto.currency);
      return isPriceAnomaly(dto.price, pickPriceStats(sub, parent));
    } catch { return false; }
  }

  /** Riziko z pravidel obsahu + z duplicit + z ceny. Vlastní duplicitu odmítne s vysvětlením. */
  private async assess(ownerId: string, listing: { id: string; createdAt: Date } | null, dto: ListingInput, publishing: boolean, cat: { id: string; parentId: string | null }) {
    const risk = assessListing({ title: dto.title, description: dto.description, price: dto.price, categorySlug: dto.categorySlug });
    const dup = await this.findDuplicates(ownerId, listing?.id ?? null, listing?.createdAt ?? new Date(), dto.title, dto.description, dto.imageIds);
    if (publishing && dup.own) {
      throw new ConflictException({ message: `Stejný inzerát už máte vložený („${dup.own.title}“). Upravte nebo prodlužte ten původní.`, field: 'title', duplicateOf: { id: dup.own.id, slug: dup.own.slug } });
    }
    let score = risk.score;
    const reasons = [...risk.reasons];
    if (dup.otherText) { score += REVIEW_SCORE; reasons.push('Shodný text s inzerátem jiného uživatele'); }
    if (dup.otherPhoto) { score += REVIEW_SCORE; reasons.push('Fotka z inzerátu jiného uživatele'); }
    if (!reasons.includes(LOW_PRICE_REASON) && (await this.lowPrice(dto, cat))) { score += PRICE_ANOMALY_SCORE; reasons.push(LOW_PRICE_REASON); }
    return { score: Math.min(100, score), reasons, hash: dup.hash };
  }

  private async priceFields(dto: ListingInput) {
    // Dar je vždy zdarma: cenu neukládáme, aby se nikde neukázala stará zadaná částka
    if (dto.offerType === 'GIVE') return { price: null, priceCzk: null, priceNegotiable: false };
    const price = dto.price ?? null;
    return { price, priceCzk: priceInCzk(price, dto.currency, await this.policy.eurRate()), priceNegotiable: dto.priceNegotiable };
  }

  private composeSeconds(dto: ListingInput) {
    return dto.composeMs != null && dto.composeMs > 0 && dto.composeMs <= 864e5 ? Math.round(dto.composeMs / 1000) : null;
  }

  async create(user: AuthUser, dto: ListingInput) {
    if (dto.publish) await this.policy.beforePublish(user.id);
    await this.checkSpam(user.id);
    const cat = await this.resolveCategory(dto.categorySlug, dto.subSlug);
    const attributes = this.cleanAttributes(cat.defs, dto.attributes, dto.publish);
    const loc = resolveLocation(dto.city, dto.zip);
    const risk = await this.assess(user.id, null, dto, dto.publish, cat);
    const status = nextStatus({ publish: dto.publish, premoderation: await this.policy.premoderation(), score: risk.score });
    const now = new Date();
    const listing = await this.prisma.listing.create({
      data: {
        slug: slugify(dto.title) || 'inzerat', title: dto.title, description: dto.description, ...(await this.priceFields(dto)),
        currency: dto.currency, categoryId: cat.id, userId: user.id, condition: dto.condition ?? null, offerType: dto.offerType,
        city: loc.city, region: loc.region, zip: loc.zip, lat: loc.lat, lng: loc.lng,
        attributes: attributes as Prisma.InputJsonValue, searchText: buildSearchText({ ...dto, attributes, city: loc.city }),
        videoUrl: dto.videoUrl || null, status, spamScore: risk.score, riskReasons: risk.reasons, contentHash: risk.hash,
        composeSeconds: status === 'DRAFT' ? null : this.composeSeconds(dto),
        publishedAt: status === 'ACTIVE' ? now : null,
        expiresAt: nextExpiry({ after: status, expiresAt: null, now, days: await this.policy.listingDays() }),
      },
    });
    await this.attachImages(listing.id, user.id, dto.imageIds);
    await this.search.index(listing.id);
    await this.policy.afterSave(user.id, risk.score, dto.title);
    return { id: listing.id, slug: listing.slug, status, moderation: risk.reasons };
  }

  private async attachImages(listingId: string, userId: string, ids: string[]) {
    await this.prisma.listingImage.updateMany({ where: { listingId, id: { notIn: ids } }, data: { listingId: null } });
    await Promise.all(ids.map((id, position) => this.prisma.listingImage.updateMany({ where: { id, ownerId: userId }, data: { listingId, position } })));
  }

  private async hasNewPhotos(listingId: string, ids: string[]) {
    const prev = new Set((await this.prisma.listingImage.findMany({ where: { listingId }, select: { id: true } })).map((i) => i.id));
    return ids.some((x) => !prev.has(x));
  }

  async ownOrThrow(id: string, user: AuthUser) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l || l.status === 'DELETED') throw new NotFoundException('Inzerát neexistuje.');
    // Jen vlastník; tým upravuje cizí inzeráty přes /admin/listings (s důvodem a auditem)
    if (l.userId !== user.id) throw new ForbiddenException('Tento inzerát vám nepatří.');
    return l;
  }

  async update(id: string, user: AuthUser, input: ListingInput) {
    const l = await this.ownOrThrow(id, user);
    // Zveřejněný (nebo zveřejňovaný) inzerát musí být úplný, i když přišel jako koncept
    const publishing = l.status !== 'DRAFT' || input.publish;
    const dto = publishing ? this.requireComplete(input) : input;
    if (publishing) await this.policy.beforePublish(user.id, id, l.status === 'DRAFT');
    const cat = await this.resolveCategory(dto.categorySlug, dto.subSlug);
    const attributes = this.cleanAttributes(cat.defs, dto.attributes, publishing);
    // Lokalita se určí vždy znovu – neznámá obec smaže kraj i souřadnice, nezůstanou ty staré
    const loc = resolveLocation(dto.city, dto.zip);
    const risk = await this.assess(l.userId, l, dto, publishing, cat);
    const premoderation = await this.policy.premoderation();
    let status = nextStatus({ current: l.status, publish: dto.publish, premoderation, score: risk.score });
    // Při premoderaci jde ke schválení i změněný text nebo nové fotografie schváleného inzerátu
    if (premoderation && l.status === 'ACTIVE' && status === 'ACTIVE' && (l.title !== dto.title || l.description !== dto.description || (await this.hasNewPhotos(id, dto.imageIds)))) status = 'PENDING';
    const now = new Date();
    const expiresAt = nextExpiry({ before: l.status, after: status, expiresAt: l.expiresAt, now, days: await this.policy.listingDays() });
    await this.prisma.listing.update({
      where: { id },
      data: {
        slug: slugify(dto.title) || 'inzerat', title: dto.title, description: dto.description, ...(await this.priceFields(dto)), currency: dto.currency,
        categoryId: cat.id, condition: dto.condition ?? null, offerType: dto.offerType,
        city: loc.city, region: loc.region, zip: loc.zip, lat: loc.lat, lng: loc.lng,
        attributes: attributes as Prisma.InputJsonValue, searchText: buildSearchText({ ...dto, attributes, city: loc.city }),
        videoUrl: dto.videoUrl || null, status, spamScore: risk.score, riskReasons: risk.reasons, contentHash: risk.hash,
        publishedAt: status === 'ACTIVE' && !l.publishedAt ? now : l.publishedAt,
        // Oprava zamítnutého inzerátu: starý důvod zamítnutí už neplatí
        rejectReason: status === 'REJECTED' ? l.rejectReason : null,
        expiresAt, ...(expiresAt?.getTime() !== l.expiresAt?.getTime() ? { expiryNotifiedAt: null } : {}),
        ...(l.status === 'DRAFT' && status !== 'DRAFT' && l.composeSeconds == null ? { composeSeconds: this.composeSeconds(dto) } : {}),
      },
    });
    await this.attachImages(id, l.userId, dto.imageIds);
    await this.search.index(id);
    await this.policy.afterSave(user.id, risk.score, dto.title);
    return { id, slug: slugify(dto.title) || 'inzerat', status, moderation: risk.reasons };
  }

  async setStatus(id: string, user: AuthUser, status: 'ACTIVE' | 'RESERVED' | 'SOLD') {
    const l = await this.ownOrThrow(id, user);
    if (!['ACTIVE', 'RESERVED', 'SOLD'].includes(l.status)) throw new BadRequestException('Stav tohoto inzerátu nelze změnit.');
    if (status !== 'SOLD' && l.status === 'SOLD') await this.policy.beforePublish(user.id, id); // WP6: znovuzveřejnění prodaného = limit a omezení účtu
    await this.prisma.listing.update({ where: { id }, data: { status } });
    await this.search.index(id);
    return { ok: true };
  }

  async renew(id: string, user: AuthUser) {
    const l = await this.ownOrThrow(id, user);
    if (!['ACTIVE', 'EXPIRED', 'RESERVED'].includes(l.status)) throw new BadRequestException('Tento inzerát nelze prodloužit.');
    if (l.status === 'EXPIRED') await this.policy.beforePublish(user.id, id);
    await this.prisma.listing.update({ where: { id }, data: { status: l.status === 'EXPIRED' ? 'ACTIVE' : l.status, expiresAt: await this.policy.expiresAt(), expiryNotifiedAt: null } });
    await this.search.index(id);
    return { ok: true };
  }

  async remove(id: string, user: AuthUser) {
    await this.ownOrThrow(id, user);
    await this.prisma.listing.update({ where: { id }, data: { status: 'DELETED' } });
    await this.search.index(id);
    return { ok: true };
  }

  async detail(id: string, viewer?: AuthUser, ip?: string) {
    const l = await this.prisma.listing.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } }, category: { include: { parent: true } },
        user: { select: { id: true, name: true, avatarUrl: true, city: true, createdAt: true, phoneVerifiedAt: true, emailVerifiedAt: true, isBusiness: true, companyName: true, companyId: true, companyVerifiedAt: true, lastSeenAt: true, phone: true, showPhone: true } },
      },
    });
    const isOwner = !!viewer && viewer.id === l?.userId;
    const staff = !!viewer && can(viewer.role, 'listings.read'); // WP6: tým vidí i neveřejné inzeráty, ale není vlastník (úpravy jen přes /admin)
    if (!l || l.status === 'DELETED' || (!isOwner && !staff && ['DRAFT', 'PENDING', 'REJECTED'].includes(l.status))) throw new NotFoundException('Inzerát neexistuje nebo byl odstraněn.');
    if (!isOwner && !staff && (await this.redis.lock(`view:${id}:${viewer?.id ?? ip}`, 3600))) {
      await this.prisma.listing.update({ where: { id }, data: { views: { increment: 1 } } });
    }
    const [rating, activeCount, favCount, isFavorite] = await Promise.all([
      this.prisma.review.aggregate({ where: { sellerId: l.userId }, _avg: { rating: true }, _count: true }),
      this.prisma.listing.count({ where: { userId: l.userId, status: 'ACTIVE' } }),
      this.prisma.favorite.count({ where: { listingId: id } }),
      viewer ? this.prisma.favorite.findUnique({ where: { userId_listingId: { userId: viewer.id, listingId: id } } }).then(Boolean) : false,
    ]);
    const { phone, showPhone, companyVerifiedAt, ...seller } = l.user;
    // Obchodní jméno a odznak jen u firmy s IČO ověřeným v ARES (stejně jako na profilu); jinak jméno osoby
    const companyVerified = seller.isBusiness && !!companyVerifiedAt && !!seller.companyId;
    // Interní údaje automatické kontroly vidí jen tým (jinak by šlo kontrolu obcházet)
    const { spamScore, riskReasons, contentHash: _hash, composeSeconds, ...pub } = l;
    return {
      ...pub, ...(staff ? { spamScore, riskReasons, composeSeconds } : {}), user: undefined, rejectReason: staff || viewer?.id === l.userId ? l.rejectReason : undefined,
      seller: { ...seller, companyName: companyVerified ? seller.companyName : null, companyVerified, phoneVerified: !!l.user.phoneVerifiedAt, emailVerified: !!l.user.emailVerifiedAt, phoneVerifiedAt: undefined, emailVerifiedAt: undefined, rating: rating._avg.rating, reviewCount: rating._count, activeListings: activeCount, hasPhone: canRevealPhone(l.status, { phone, phoneVerifiedAt: l.user.phoneVerifiedAt, showPhone }, false) },
      favorites: favCount, isFavorite, isOwner: !!isOwner, filters: l.category.parent ? effectiveFilters(l.category.parent.slug, l.category.parent.filters, l.category.slug, l.category.filters) : [],
    };
  }

  async revealPhone(id: string, viewer: AuthUser) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: { user: { select: { phone: true, phoneVerifiedAt: true, showPhone: true, status: true } } } });
    const blocked = !!l && l.userId !== viewer.id && (await this.prisma.block.count({ where: { OR: [{ blockerId: l.userId, blockedId: viewer.id }, { blockerId: viewer.id, blockedId: l.userId }] } })) > 0;
    if (!l?.user.phone || !canRevealPhone(l.status, l.user, blocked)) throw new NotFoundException('Prodejce telefon nezveřejnil.');
    if ((await this.redis.incr(`phone:${viewer.id}`, 86400)) > 50) throw new BadRequestException('Denní limit zobrazení telefonu vyčerpán.');
    return { phone: l.user.phone };
  }

  async similar(id: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, include: { category: { include: { parent: true } } } });
    if (!l) return [];
    const words = l.title.split(/\s+/).filter((w) => w.length > 2).slice(0, 3).join(' ');
    let r = await this.search.search({ q: words, category: l.category.parent?.slug, sub: l.category.slug }, { limit: 9 });
    if (r.hits.length < 4) r = await this.search.search({ category: l.category.parent?.slug, sub: l.category.slug }, { limit: 9 });
    return r.hits.filter((h) => h.id !== id).slice(0, 8);
  }

  /** Doporučená cena: medián cen podobných aktivních inzerátů ve stejné podkategorii. */
  async priceSuggestion(title: string, categorySlug?: string, subSlug?: string) {
    const r = await this.search.search({ q: title.split(/\s+/).slice(0, 4).join(' '), category: categorySlug, sub: subSlug }, { limit: 60 });
    const prices = r.hits.map((h) => h.price).filter((p): p is number => p != null && p > 0).sort((a, b) => a - b);
    if (prices.length < 3) return { sample: prices.length, median: null };
    const q = (f: number) => prices[Math.min(prices.length - 1, Math.floor(f * prices.length))];
    const round = (n: number) => (n > 10000 ? Math.round(n / 500) * 500 : n > 1000 ? Math.round(n / 50) * 50 : Math.round(n / 10) * 10);
    return { sample: prices.length, median: round(q(0.5)), low: round(q(0.25)), high: round(q(0.75)) };
  }

  /** Návrh kategorie z názvu: nejčastější podkategorie mezi nejrelevantnějšími výsledky. */
  async suggestCategory(title: string) {
    const r = await this.search.search({ q: title }, { limit: 30 });
    const counts = new Map<string, { parent: string; sub: string; name: string; n: number }>();
    r.hits.forEach((h, i) => {
      const k = `${h.parentCategorySlug}/${h.categorySlug}`;
      const cur = counts.get(k) ?? { parent: h.parentCategorySlug, sub: h.categorySlug, name: h.categoryName, n: 0 };
      cur.n += 30 - i; counts.set(k, cur);
    });
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 3).map(({ n, ...c }) => c);
  }

  async mine(userId: string, status?: string) {
    const known = !!status && status !== 'DELETED' && (Object.values(ListingStatus) as string[]).includes(status);
    const where: Prisma.ListingWhereInput = { userId, status: known ? (status as ListingStatus) : { not: 'DELETED' } };
    const rows = await this.prisma.listing.findMany({ where, include: { ...LISTING_INCLUDE, _count: { select: { favorites: true, conversations: true } } }, orderBy: { createdAt: 'desc' }, take: 200 });
    return rows.map((l) => ({ ...this.search.toCard(l), views: l.views, favorites: l._count.favorites, conversations: l._count.conversations, expiresAt: l.expiresAt, rejectReason: l.rejectReason }));
  }

  async forEdit(id: string, user: AuthUser) {
    await this.ownOrThrow(id, user);
    return this.prisma.listing.findUnique({ where: { id }, include: { images: { orderBy: { position: 'asc' } }, category: { include: { parent: true } } } });
  }
}
