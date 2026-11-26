import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { nearestMunicipality, suggestMunicipalities } from '@dej/shared/dist/municipalities';
import { z } from 'zod';
import { Auth, AuthUser, CurrentUser, Roles } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { LISTING_INCLUDE, SearchService } from './search.service';

const SuggestQuery = z.object({
  q: z.string().trim().max(80).default(''),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

const NearestQuery = z.object({
  lat: z.coerce.number({ error: 'Neplatná zeměpisná šířka.' }).min(-90).max(90),
  lng: z.coerce.number({ error: 'Neplatná zeměpisná délka.' }).min(-180).max(180),
});

const slug = z.string().regex(/^[a-z0-9-]{1,60}$/);
const RecommendedQuery = z.object({
  /** Zájmy z prohlížeče: „kategorie/podkategorie“ oddělené čárkou, nejnovější první */
  kat: z.string().max(1000).default('').transform((s) => s.split(',').map((x) => x.split('/')).filter((x): x is [string, string] => x.length === 2 && slug.safeParse(x[0]).success && slug.safeParse(x[1]).success).slice(0, 10)),
  /** Inzeráty, které uživatel už viděl */
  bez: z.string().max(2000).default('').transform((s) => s.split(',').filter((x) => /^[a-z0-9]{10,40}$/.test(x)).slice(0, 60)),
  limit: z.coerce.number().int().min(1).max(24).default(8),
});

const LimitQuery = z.object({ limit: z.coerce.number().int().min(1).max(24).default(8) });

const PromoteDto = z.object({
  topDays: z.number().int().min(0).max(90).optional(),
  highlightDays: z.number().int().min(0).max(90).optional(),
}).refine((d) => d.topDays !== undefined || d.highlightDays !== undefined, 'Zadejte počet dní topování nebo zvýraznění.');

/** Lokality, prémiové a doporučené nabídky na hlavní stránce, ID oblíbených. */
@Controller()
export class DiscoveryController {
  constructor(private prisma: PrismaService, private search: SearchService) {}

  /** Našeptávač obcí ČR (název bez ohledu na diakritiku, nebo PSČ). */
  @Get('locations/suggest')
  locations(@Query(new ZodPipe(SuggestQuery)) q: z.infer<typeof SuggestQuery>) {
    return suggestMunicipalities(q.q, q.limit).map((m) => ({ name: m.name, label: m.label, district: m.district, region: m.region, regionName: m.regionName, zip: m.zip, lat: m.lat, lng: m.lng }));
  }

  /** Nejbližší obec k poloze z prohlížeče. */
  @Get('locations/nearest')
  nearest(@Query(new ZodPipe(NearestQuery)) q: z.infer<typeof NearestQuery>) {
    const m = nearestMunicipality(q.lat, q.lng);
    if (!m) throw new NotFoundException('Obec nenalezena.');
    return { name: m.name, district: m.district, region: m.region, zip: m.zip, lat: m.lat, lng: m.lng };
  }

  /** Prémiové a zvýrazněné nabídky – jen s platným (nevypršelým) topováním nebo zvýrazněním. */
  @Get('search/premium')
  async premium(@Query(new ZodPipe(LimitQuery)) q: z.infer<typeof LimitQuery>) {
    const now = new Date();
    const rows = await this.prisma.listing.findMany({
      where: { status: 'ACTIVE', OR: [{ topUntil: { gt: now } }, { highlightedUntil: { gt: now } }] },
      include: LISTING_INCLUDE,
      orderBy: [{ topUntil: { sort: 'desc', nulls: 'last' } }, { publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take: q.limit,
    });
    return rows.map((l) => this.search.toCard(l, now.getTime()));
  }

  /**
   * „Doporučeno pro vás“: nejnovější nabídky z kategorií, které si uživatel prohlížel (z prohlížeče)
   * nebo uložil do oblíbených (přihlášený). Bez vlastních a už oblíbených inzerátů.
   */
  @Auth('optional')
  @Get('search/recommended')
  async recommended(@Query(new ZodPipe(RecommendedQuery)) q: z.infer<typeof RecommendedQuery>, @CurrentUser() u?: AuthUser) {
    const weights = new Map<string, number>();
    q.kat.forEach(([p, s], i) => weights.set(`${p}/${s}`, (weights.get(`${p}/${s}`) ?? 0) + 10 - i));
    let favIds: string[] = [];
    if (u) {
      const favs = await this.prisma.favorite.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 40, select: { listingId: true, listing: { select: { category: { select: { slug: true, parent: { select: { slug: true } } } } } } } });
      favIds = favs.map((f) => f.listingId);
      favs.forEach((f, i) => {
        const c = f.listing.category;
        if (!c.parent) return;
        const k = `${c.parent.slug}/${c.slug}`;
        weights.set(k, (weights.get(k) ?? 0) + Math.max(3, 12 - i));
      });
    }
    const cats = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k.split('/') as [string, string]);
    if (!cats.length) return { hits: [], basedOn: [] };
    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      OR: cats.map(([p, s]) => ({ category: { slug: s, parent: { slug: p } } })),
      id: { notIn: [...q.bez, ...favIds] },
      ...(u ? { userId: { not: u.id } } : {}),
    };
    const rows = await this.prisma.listing.findMany({ where, include: LISTING_INCLUDE, orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], take: q.limit * 3 });
    // Střídáme kategorie, ať jedna nepřehluší ostatní
    const buckets = cats.map(([p, s]) => rows.filter((l) => l.category.slug === s && l.category.parent?.slug === p));
    const out: typeof rows = [];
    for (let i = 0; out.length < q.limit && buckets.some((b) => b.length > i); i++) for (const b of buckets) if (b[i] && out.length < q.limit) out.push(b[i]);
    // Málo nabídek v podkategoriích → doplníme z jejich hlavních kategorií
    if (out.length < q.limit) {
      const parents = [...new Set(cats.map(([p]) => p))];
      const more = await this.prisma.listing.findMany({
        where: { ...where, OR: parents.map((p) => ({ category: { parent: { slug: p } } })), id: { notIn: [...q.bez, ...favIds, ...out.map((l) => l.id)] } },
        include: LISTING_INCLUDE, orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }], take: q.limit - out.length,
      });
      out.push(...more);
    }
    const basedOn = [...new Set(out.map((l) => l.category.parent?.name ?? l.category.name))];
    return { hits: out.map((l) => this.search.toCard(l)), basedOn };
  }

  /** ID inzerátů v oblíbených – aby srdíčka v mřížkách svítila správně. */
  @Auth()
  @Get('me/favorites/ids')
  async favoriteIds(@CurrentUser() u: AuthUser) {
    const favs = await this.prisma.favorite.findMany({ where: { userId: u.id }, select: { listingId: true }, orderBy: { createdAt: 'desc' }, take: 2000 });
    return favs.map((f) => f.listingId);
  }

  /** Topování / zvýraznění inzerátu administrátorem (než budou platby). 0 dní = zrušit. */
  @Roles('ADMIN')
  @Post('admin/listings/:id/promote')
  async promote(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(PromoteDto)) dto: z.infer<typeof PromoteDto>) {
    const l = await this.prisma.listing.findUnique({ where: { id }, select: { id: true } });
    if (!l) throw new NotFoundException('Inzerát neexistuje.');
    const until = (days?: number) => (days === undefined ? undefined : days === 0 ? null : new Date(Date.now() + days * 864e5));
    const data = { topUntil: until(dto.topDays), highlightedUntil: until(dto.highlightDays) };
    const r = await this.prisma.listing.update({ where: { id }, data, select: { topUntil: true, highlightedUntil: true } });
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: 'listing.promote', targetType: 'LISTING', targetId: id, meta: dto as Prisma.InputJsonValue } });
    await this.search.index(id);
    return r;
  }
}
