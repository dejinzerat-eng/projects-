import { BadRequestException, Body, Controller, Delete, Get, Header, NotFoundException, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CITIES, findCity, savedSearchKey, type SearchParams } from '@dej/shared';
import { z } from 'zod';
import { Auth, AuthUser, CurrentUser } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { clientInfo } from '../auth/audit';
import { AuthService } from '../auth/auth.service';
import { LISTING_INCLUDE, SearchService } from '../search/search.service';
import { resolveCompany } from './company';
import { anonymizeOps, buildExport } from './gdpr';
import { aresWebUrl } from './ico';
import { trustScore } from './trust';

const ProfileDto = z.object({
  name: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(600).optional(),
  city: z.string().trim().max(80).optional(),
  isBusiness: z.boolean().optional(),
  companyName: z.string().trim().max(120).optional(),
  companyId: z.string().trim().regex(/^\d{8}$/, 'IČO má 8 číslic.').optional().or(z.literal('')),
  avatarUrl: z.null({ error: 'Profilovou fotku nahrajte v nastavení účtu.' }).optional(), // fotku nahrává POST /auth/avatar, tady jde jen odstranit
});
const PhoneVisibilityDto = z.object({ showPhone: z.boolean({ error: 'Neplatná hodnota.' }) });
const HistoryQuery = z.object({ page: z.coerce.number({ error: 'Neplatné číslo stránky.' }).int('Neplatné číslo stránky.').min(1, 'Neplatné číslo stránky.').max(500, 'Neplatné číslo stránky.').default(1) });

const SavedSearchDto = z.object({ name: z.string().trim().min(1).max(120), query: z.record(z.string(), z.unknown()), notify: z.boolean().default(true) });

/** Historie nabídek: prodané a ukončené (vypršelé) inzeráty */
const HISTORY_STATUSES = ['SOLD', 'EXPIRED'] as const;
const HISTORY_PAGE = 12;

@Controller()
export class UsersController {
  constructor(private prisma: PrismaService, private search: SearchService, private auth: AuthService) {}

  @Get('cities')
  cities() { return CITIES.map((c) => ({ name: c.name, region: c.region, zip: c.zip })); }

  @Auth('optional')
  @Get('users/:id')
  async profile(@Param('id') id: string, @CurrentUser() viewer?: AuthUser) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true, name: true, avatarUrl: true, bio: true, city: true, createdAt: true, lastSeenAt: true, phoneVerifiedAt: true, emailVerifiedAt: true, isBusiness: true, companyName: true, companyId: true, companyAddress: true, vatId: true, companyVerifiedAt: true, status: true } });
    if (!u || u.status === 'BLOCKED') throw new NotFoundException('Uživatel neexistuje.');
    const [listings, rating, dist, reviews, sold, followers, following, history] = await Promise.all([
      this.prisma.listing.findMany({ where: { userId: id, status: { in: ['ACTIVE', 'RESERVED'] } }, include: LISTING_INCLUDE, orderBy: { createdAt: 'desc' }, take: 60 }),
      this.prisma.review.aggregate({ where: { sellerId: id }, _avg: { rating: true }, _count: true }),
      this.prisma.review.groupBy({ by: ['rating'], where: { sellerId: id }, _count: true }),
      this.prisma.review.findMany({ where: { sellerId: id }, include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.listing.count({ where: { userId: id, status: 'SOLD' } }),
      this.prisma.followSeller.count({ where: { sellerId: id } }),
      viewer ? this.prisma.followSeller.findUnique({ where: { followerId_sellerId: { followerId: viewer.id, sellerId: id } } }).then(Boolean) : false,
      this.historyPage(id, 1),
    ]);
    const companyVerified = u.isBusiness && !!u.companyVerifiedAt && !!u.companyId;
    const trust = trustScore({
      emailVerified: !!u.emailVerifiedAt, phoneVerified: !!u.phoneVerifiedAt, isBusiness: u.isBusiness, companyVerified, companyId: u.companyId,
      createdAt: u.createdAt, ratingCount: rating._count, ratingAvg: rating._avg.rating, sold,
    });
    return {
      id: u.id, name: u.name, avatarUrl: u.avatarUrl, bio: u.bio, city: u.city, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt, isBusiness: u.isBusiness,
      // Neověřený název firmy nezveřejňujeme (ochrana před vydáváním se za cizí firmu)
      companyName: companyVerified ? u.companyName : null,
      company: u.isBusiness ? (companyVerified
        ? { verified: true, name: u.companyName, ico: u.companyId, vatId: u.vatId, address: u.companyAddress, verifiedAt: u.companyVerifiedAt, aresUrl: aresWebUrl(u.companyId!) }
        : { verified: false, name: null, ico: null, vatId: null, address: null, verifiedAt: null, aresUrl: null }) : null,
      phoneVerified: !!u.phoneVerifiedAt, emailVerified: !!u.emailVerifiedAt,
      rating: rating._avg.rating, reviewCount: rating._count, ratingDistribution: Object.fromEntries(dist.map((d) => [d.rating, d._count])),
      reviews, soldCount: sold, followers, isFollowing: following, trust: trust.score, trustBreakdown: trust.breakdown,
      listings: listings.map((l) => this.search.toCard(l)),
      history,
    };
  }

  /** Historie nabídek na veřejném profilu (stránkovaná) */
  @Get('users/:id/history')
  async history(@Param('id') id: string, @Query(new ZodPipe(HistoryQuery)) q: z.infer<typeof HistoryQuery>) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { status: true } });
    if (!u || u.status !== 'ACTIVE') throw new NotFoundException('Uživatel neexistuje.');
    return this.historyPage(id, q.page);
  }

  /** IČO smí mít ověřené jen jeden účet */
  private icoTaken(userId: string) {
    return async (ico: string) => !!(await this.prisma.user.findFirst({ where: { companyId: ico, companyVerifiedAt: { not: null }, status: 'ACTIVE', id: { not: userId } }, select: { id: true } }));
  }

  private async historyPage(userId: string, page: number) {
    const where = { userId, status: { in: [...HISTORY_STATUSES] } } satisfies Prisma.ListingWhereInput;
    const [total, rows] = await Promise.all([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({ where, include: LISTING_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * HISTORY_PAGE, take: HISTORY_PAGE }),
    ]);
    return { items: rows.map((l) => this.search.toCard(l)), page, pages: Math.max(1, Math.ceil(total / HISTORY_PAGE)), total };
  }

  @Auth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // každé uložení s IČO může volat ARES
  @Patch('me')
  async updateMe(@CurrentUser() u: AuthUser, @Body(new ZodPipe(ProfileDto)) dto: z.infer<typeof ProfileDto>) {
    const cur = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { isBusiness: true, companyId: true, companyName: true, companyVerifiedAt: true } });
    const { isBusiness, companyName, companyId, ...rest } = dto;
    const company = await resolveCompany(cur, { isBusiness, companyName, companyId }, undefined, undefined, this.icoTaken(u.id));
    const city = dto.city ? findCity(dto.city) : undefined;
    await this.prisma.user.update({ where: { id: u.id }, data: { ...rest, ...company.data, city: city?.name ?? dto.city, region: city?.region } });
    await this.auth.flushUser(u.id);
    return { ok: true, company: company.status };
  }

  /** Nastavení kontaktu a firmy (pro stránku Nastavení účtu) */
  @Auth()
  @Get('me/seller-settings')
  async sellerSettings(@CurrentUser() u: AuthUser) {
    const x = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { phone: true, phoneVerifiedAt: true, showPhone: true, isBusiness: true, companyId: true, companyName: true, companyAddress: true, vatId: true, companyVerifiedAt: true } });
    const verified = !!x.phoneVerifiedAt && !!x.phone;
    return {
      phone: verified ? x.phone : null, phoneVerified: verified, showPhone: x.showPhone,
      company: x.isBusiness ? { ico: x.companyId, name: x.companyName, address: x.companyAddress, vatId: x.vatId, verifiedAt: x.companyVerifiedAt, status: x.companyVerifiedAt ? 'verified' : x.companyId ? 'unverified' : 'none' } : null,
    };
  }

  @Auth()
  @Patch('me/phone-visibility')
  async phoneVisibility(@CurrentUser() u: AuthUser, @Body(new ZodPipe(PhoneVisibilityDto)) dto: z.infer<typeof PhoneVisibilityDto>) {
    if (dto.showPhone) {
      const x = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { phone: true, phoneVerifiedAt: true } });
      if (!x.phone || !x.phoneVerifiedAt) throw new BadRequestException('Nejdřív si ověřte telefonní číslo.');
    }
    await this.prisma.user.update({ where: { id: u.id }, data: { showPhone: dto.showPhone } });
    return { ok: true, showPhone: dto.showPhone };
  }

  /** Odebrání telefonu z účtu (zmizí i odznak ověřeného telefonu) */
  @Auth()
  @Delete('me/phone')
  async removePhone(@CurrentUser() u: AuthUser) {
    await this.prisma.user.update({ where: { id: u.id }, data: { phone: null, phoneVerifiedAt: null, showPhone: false } });
    await this.auth.flushUser(u.id);
    return { ok: true };
  }

  /** Opakované ověření IČO v ARES (např. když registr při uložení neodpovídal) */
  @Auth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('me/company/verify')
  async verifyCompany(@CurrentUser() u: AuthUser) {
    const cur = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { isBusiness: true, companyId: true, companyName: true, companyVerifiedAt: true } });
    if (!cur.isBusiness || !cur.companyId) throw new BadRequestException('Nejdřív v profilu vyplňte IČO.');
    const company = await resolveCompany({ ...cur, companyVerifiedAt: null }, { companyId: cur.companyId }, undefined, undefined, this.icoTaken(u.id));
    await this.prisma.user.update({ where: { id: u.id }, data: company.data });
    if (company.status !== 'verified') throw new BadRequestException('Registr ARES teď neodpovídá. Zkuste to prosím později.');
    return { ok: true, company: company.status };
  }

  /** GDPR: export všech osobních údajů */
  @Auth()
  @Get('me/export')
  @Header('Content-Disposition', 'attachment; filename="dejinzerat-moje-data.json"')
  @Header('Cache-Control', 'no-store')
  async exportData(@CurrentUser() u: AuthUser, @Req() req: Request) {
    await this.auth.audit(u.id, 'account.gdpr_export', clientInfo(req));
    const data = await buildExport(this.prisma, u.id);
    if (!data) throw new NotFoundException('Uživatel neexistuje.');
    return data;
  }

  /** GDPR: smazání účtu – anonymizace osobních údajů a odstranění inzerátů */
  @Auth()
  @Delete('me')
  async deleteMe(@CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ password: z.string().max(200).optional() }).optional())) dto: { password?: string } | undefined, @Req() req: Request) {
    await this.auth.assertPassword(u.id, dto?.password);
    await this.auth.audit(u.id, 'account.delete', clientInfo(req));
    const live = await this.prisma.listing.findMany({ where: { userId: u.id, status: { in: ['ACTIVE', 'RESERVED'] } }, select: { id: true } });
    await this.prisma.$transaction(anonymizeOps(this.prisma, u.id));
    await this.auth.revokeAll(u.id);
    await Promise.all(live.map((l) => this.search.index(l.id).catch(() => undefined)));
    return { ok: true };
  }

  @Auth()
  @Post('users/:id/follow')
  async follow(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    if (id !== u.id) await this.prisma.followSeller.upsert({ where: { followerId_sellerId: { followerId: u.id, sellerId: id } }, create: { followerId: u.id, sellerId: id }, update: {} });
    return { ok: true };
  }

  @Auth()
  @Delete('users/:id/follow')
  async unfollow(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    await this.prisma.followSeller.deleteMany({ where: { followerId: u.id, sellerId: id } });
    return { ok: true };
  }

  @Auth()
  @Get('me/following')
  async following(@CurrentUser() u: AuthUser) {
    const f = await this.prisma.followSeller.findMany({ where: { followerId: u.id }, include: { seller: { select: { id: true, name: true, avatarUrl: true, city: true, phoneVerifiedAt: true, _count: { select: { listings: { where: { status: 'ACTIVE' } } } } } } } });
    return f.map((x) => ({ ...x.seller, activeListings: x.seller._count.listings, _count: undefined }));
  }

  @Auth()
  @Get('me/saved-searches')
  saved(@CurrentUser() u: AuthUser) { return this.prisma.savedSearch.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } }); }

  @Auth()
  @Post('me/saved-searches')
  async save(@CurrentUser() u: AuthUser, @Body(new ZodPipe(SavedSearchDto)) dto: z.infer<typeof SavedSearchDto>) {
    // Stejné hledání podruhé neukládáme (porovnání normalizovaných podmínek, ne doslovného JSON)
    const mine = await this.prisma.savedSearch.findMany({ where: { userId: u.id } });
    const key = savedSearchKey(dto.query as SearchParams);
    const existing = mine.find((s) => savedSearchKey(s.query as SearchParams) === key);
    // Už uložené, ale s vypnutými upozorněními: „Hlídat“ je znovu zapne
    if (existing) return existing.notify || !dto.notify ? existing : this.prisma.savedSearch.update({ where: { id: existing.id }, data: { notify: true } });
    if (mine.length >= 50) throw new BadRequestException('Nejvýše 50 uložených hledání.');
    return this.prisma.savedSearch.create({ data: { userId: u.id, name: dto.name, query: dto.query as Prisma.InputJsonValue, notify: dto.notify } });
  }

  @Auth()
  @Patch('me/saved-searches/:id')
  async toggleSaved(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ notify: z.boolean() }))) dto: { notify: boolean }) {
    await this.prisma.savedSearch.updateMany({ where: { id, userId: u.id }, data: { notify: dto.notify } });
    return { ok: true };
  }

  @Auth()
  @Delete('me/saved-searches/:id')
  async deleteSaved(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    await this.prisma.savedSearch.deleteMany({ where: { id, userId: u.id } });
    return { ok: true };
  }

  @Auth()
  @Get('me/notifications')
  notifications(@CurrentUser() u: AuthUser) { return this.prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 50 }); }

  @Auth()
  @Post('me/notifications/read')
  async readAll(@CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @Auth()
  @Get('me/blocked')
  async blockedList(@CurrentUser() u: AuthUser) {
    const b = await this.prisma.block.findMany({ where: { blockerId: u.id }, include: { blocked: { select: { id: true, name: true } } } });
    return b.map((x) => x.blocked);
  }

  @Get('pages/:slug')
  async page(@Param('slug') slug: string) {
    const p = await this.prisma.page.findUnique({ where: { slug } });
    if (!p) throw new NotFoundException();
    return p;
  }

  @Get('prices')
  prices() { return this.prisma.priceItem.findMany({ where: { active: true }, orderBy: { priceCzk: 'asc' } }); }
}
