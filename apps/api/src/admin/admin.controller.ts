import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ListingStatus } from '@prisma/client';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../common/auth.guard';
import { Can } from '../common/permissions';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { assessListingDetailed } from '../listings/moderation';
import { LISTING_INCLUDE, SearchService } from '../search/search.service';
import { audit, diff } from './audit';
import { ListingPolicyService } from './listing-policy.service';

const STATUSES = ['DRAFT', 'PENDING', 'ACTIVE', 'RESERVED', 'SOLD', 'EXPIRED', 'REJECTED', 'DELETED'] as const;
const reason = z.string({ error: 'Uveďte důvod úpravy.' }).trim().min(3, 'Uveďte důvod (alespoň 3 znaky).').max(500);

const ModerateDto = z.object({ action: z.enum(['approve', 'reject', 'delete']), reason: z.string().trim().max(500).optional() })
  .refine((d) => d.action === 'approve' || (d.reason?.length ?? 0) >= 3, { message: 'Uveďte důvod (uvidí ho autor).', path: ['reason'] });
const StaffEditDto = z.object({
  title: z.string().trim().min(5, 'Název musí mít alespoň 5 znaků.').max(90).optional(),
  description: z.string().trim().min(20, 'Popis musí mít alespoň 20 znaků.').max(8000).optional(),
  price: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
  status: z.enum(['ACTIVE', 'RESERVED', 'SOLD', 'EXPIRED']).optional(),
  reason,
});
const PromoteDto = z.object({ topDays: z.number().int().min(0).max(90).optional(), highlightDays: z.number().int().min(0).max(90).optional(), bump: z.boolean().optional(), reason });

/** Administrace: přehled, moderace inzerátů, auditní log. Oprávnění podle mapy rolí (@Can). */
@Controller('admin')
export class AdminController {
  constructor(private prisma: PrismaService, private search: SearchService, private policy: ListingPolicyService) {}

  @Can('stats.read')
  @Get('stats')
  async stats() {
    const ago = (days: number) => new Date(Date.now() - days * 864e5);
    const [day, week, month] = [ago(1), ago(7), ago(30)];
    const u = this.prisma.user, l = this.prisma.listing;
    const [users, users7, users30, dau, wau, mau, listings, byStatus, listings24, listings7, listings30, reports, reportTargets, messages7, businessesActive, businessesTotal, businessesVerified, restricted, byCat] = await Promise.all([
      u.count(), u.count({ where: { createdAt: { gte: week } } }), u.count({ where: { createdAt: { gte: month } } }),
      u.count({ where: { lastActiveAt: { gte: day } } }), u.count({ where: { lastActiveAt: { gte: week } } }), u.count({ where: { lastActiveAt: { gte: month } } }),
      l.count({ where: { status: { not: 'DELETED' } } }), l.groupBy({ by: ['status'], _count: true }),
      l.count({ where: { createdAt: { gte: day } } }), l.count({ where: { createdAt: { gte: week } } }), l.count({ where: { createdAt: { gte: month } } }),
      this.prisma.report.count({ where: { status: 'OPEN' } }),
      this.prisma.report.groupBy({ by: ['targetType', 'targetId'], where: { status: 'OPEN' } }).then((g) => g.length),
      this.prisma.message.count({ where: { createdAt: { gte: week } } }),
      u.count({ where: { isBusiness: true, status: 'ACTIVE', listings: { some: { status: 'ACTIVE' } } } }),
      u.count({ where: { isBusiness: true } }), u.count({ where: { isBusiness: true, companyVerifiedAt: { not: null } } }),
      u.count({ where: { status: 'RESTRICTED' } }),
      this.prisma.$queryRaw<{ name: string; n: bigint }[]>`SELECT p.name, COUNT(*)::bigint AS n FROM "Listing" l JOIN "Category" c ON c.id = l."categoryId" JOIN "Category" p ON p.id = c."parentId" WHERE l.status = 'ACTIVE' GROUP BY p.name ORDER BY n DESC`,
    ]);
    const daily = await this.prisma.$queryRaw<{ d: Date; listings: bigint; users: bigint }[]>`
      SELECT d::date AS d,
        (SELECT COUNT(*) FROM "Listing" WHERE "createdAt"::date = d::date)::bigint AS listings,
        (SELECT COUNT(*) FROM "User" WHERE "createdAt"::date = d::date)::bigint AS users
      FROM generate_series(${month}::date, now()::date, '1 day') d ORDER BY d`;
    const status = Object.fromEntries(STATUSES.map((s) => [s, byStatus.find((b) => b.status === s)?._count ?? 0]));
    return {
      users, users7, users30, dau, wau, mau,
      listings, active: status.ACTIVE, pending: status.PENDING, byStatus: status, listings24, listings7, listings30,
      reports, reportTargets, messages7, businessesActive, businessesTotal, businessesVerified, restricted, revenue30: 0,
      byCategory: byCat.map((c) => ({ name: c.name, count: Number(c.n) })),
      daily: daily.map((d) => ({ date: d.d.toISOString().slice(0, 10), listings: Number(d.listings), users: Number(d.users) })),
      searchEngine: this.search.usingMeili ? 'Meilisearch' : 'PostgreSQL (záložní)',
    };
  }

  @Can('listings.read')
  @Get('listings')
  async listings(@Query('status') status = 'PENDING', @Query('q') q?: string) {
    const st = z.enum([...STATUSES, 'ALL']).catch('PENDING').parse(status);
    const rows = await this.prisma.listing.findMany({
      where: { ...(st !== 'ALL' ? { status: st } : {}), ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { id: q }, { user: { email: { contains: q, mode: 'insensitive' } } }] } : {}) },
      include: { ...LISTING_INCLUDE, images: { orderBy: { position: 'asc' } }, user: { select: { id: true, name: true, email: true, status: true, phoneVerifiedAt: true, emailVerifiedAt: true, isBusiness: true, companyName: true } } },
      orderBy: [{ spamScore: 'desc' }, { createdAt: 'desc' }], take: 100,
    });
    const reportCounts = await this.prisma.report.groupBy({ by: ['targetId'], where: { targetType: 'LISTING', status: 'OPEN', targetId: { in: rows.map((r) => r.id) } }, _count: true });
    return rows.map((l) => {
      const risk = assessListingDetailed({ title: l.title, description: l.description, price: l.price, categorySlug: l.category.parent?.slug ?? l.category.slug });
      return {
        ...this.search.toCard(l), spamScore: l.spamScore, riskReasons: risk.reasons, riskLabels: risk.labels,
        images: l.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl })),
        userEmail: l.user.email, userName: l.user.name, userId: l.userId, userStatus: l.user.status,
        description: l.description, rejectReason: l.rejectReason, topUntil: l.topUntil, highlightedUntil: l.highlightedUntil,
        openReports: reportCounts.find((r) => r.targetId === l.id)?._count ?? 0,
      };
    });
  }

  @Can('listings.moderate')
  @Post('listings/:id/moderate')
  async moderate(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(ModerateDto)) dto: z.infer<typeof ModerateDto>) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Inzerát neexistuje.');
    const status: ListingStatus = dto.action === 'approve' ? 'ACTIVE' : dto.action === 'reject' ? 'REJECTED' : 'DELETED';
    // Schválený inzerát má plnou platnost od schválení (čekání ve frontě se do platnosti nepočítá)
    const renew = status === 'ACTIVE' && (!l.publishedAt || !l.expiresAt || l.expiresAt < new Date());
    await this.prisma.listing.update({ where: { id }, data: { status, rejectReason: dto.action === 'approve' ? null : dto.reason, publishedAt: status === 'ACTIVE' ? (l.publishedAt ?? new Date()) : l.publishedAt, ...(renew ? { expiresAt: await this.policy.expiresAt(), expiryNotifiedAt: null } : {}) } });
    const title = { approve: `Inzerát „${l.title}“ byl schválen`, reject: `Inzerát „${l.title}“ byl zamítnut`, delete: `Inzerát „${l.title}“ byl odstraněn moderátorem` }[dto.action];
    await this.prisma.notification.create({ data: { userId: l.userId, type: 'moderation', title, body: dto.reason, link: '/muj-ucet/inzeraty' } });
    await audit(this.prisma, u, `listing.${dto.action}`, 'listing', id, { reason: dto.reason ?? null, from: l.status, to: status, owner: l.userId });
    await this.search.index(id);
    return { ok: true };
  }

  /** Úprava cizího inzerátu členem týmu – vždy s důvodem, zapisuje se do auditu a autor dostane upozornění. */
  @Can('listings.edit')
  @Patch('listings/:id')
  async staffEdit(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(StaffEditDto)) dto: z.infer<typeof StaffEditDto>) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l || l.status === 'DELETED') throw new NotFoundException('Inzerát neexistuje.');
    const { reason: why, ...patch } = dto;
    const changes = diff(l as unknown as Record<string, unknown>, patch);
    if (!Object.keys(changes).length) throw new BadRequestException('Nic se nezměnilo.');
    const reactivate = patch.status === 'ACTIVE' && l.status !== 'ACTIVE';
    await this.prisma.listing.update({ where: { id }, data: { ...patch, ...(reactivate && !l.publishedAt ? { publishedAt: new Date() } : {}), ...(reactivate && (!l.expiresAt || l.expiresAt < new Date()) ? { expiresAt: await this.policy.expiresAt(), expiryNotifiedAt: null } : {}) } });
    await this.prisma.notification.create({ data: { userId: l.userId, type: 'moderation', title: `Moderátor upravil váš inzerát „${patch.title ?? l.title}“`, body: why, link: '/muj-ucet/inzeraty' } });
    await audit(this.prisma, u, 'listing.staff_edit', 'listing', id, { reason: why, owner: l.userId, changes });
    await this.search.index(id);
    return { ok: true, changed: Object.keys(changes) };
  }

  /** Ruční přidělení topování / zvýraznění / posunutí (např. reklamace, kompenzace, firemní tarif). */
  @Can('listings.promote')
  @Post('listings/:id/promote')
  async promote(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(PromoteDto)) dto: z.infer<typeof PromoteDto>) {
    const l = await this.prisma.listing.findUnique({ where: { id } });
    if (!l || l.status === 'DELETED') throw new NotFoundException('Inzerát neexistuje.');
    const until = (days?: number) => (days === undefined ? undefined : days === 0 ? null : new Date(Date.now() + days * 864e5));
    const data = { topUntil: until(dto.topDays), highlightedUntil: until(dto.highlightDays), bumpedAt: dto.bump ? new Date() : undefined };
    if (Object.values(data).every((v) => v === undefined)) throw new BadRequestException('Vyberte službu.');
    await this.prisma.listing.update({ where: { id }, data });
    await audit(this.prisma, u, 'listing.promote', 'listing', id, { owner: l.userId, ...dto });
    await this.search.index(id);
    return { ok: true };
  }

  @Can('audit.read')
  @Get('audit')
  auditLog(@Query('action') action?: string, @Query('targetId') targetId?: string) {
    return this.prisma.auditLog.findMany({
      where: { ...(action ? { action: { startsWith: action } } : {}), ...(targetId ? { targetId } : {}) },
      include: { actor: { select: { name: true, email: true, role: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  @Can('search.reindex')
  @Post('reindex')
  async reindex(@CurrentUser() u: AuthUser) {
    const n = await this.search.reindexAll();
    await audit(this.prisma, u, 'search.reindex', 'search', 'listings', { n });
    return { indexed: n };
  }
}
