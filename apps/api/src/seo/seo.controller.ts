import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { CITIES } from '@dej/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../common/auth.guard';
import { Can } from '../common/permissions';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ZodPipe } from '../common/zod';
import { isGone, normalizePath, PageMetaDto, RedirectDto, SITEMAP_CHUNK, toDate } from './seo.logic';

const CZ_CITIES = new Set(CITIES.filter((c) => c.region.length === 3).map((c) => c.name));
const PUBLIC_STATUSES = ['ACTIVE', 'RESERVED'] as const;

/** Veřejná data pro SEO: sitemapy, odstraněné inzeráty, přesměrování, úvodní texty a lokality. */
@Controller('seo')
export class SeoController {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  /** Přehled pro index sitemap: počty inzerátů a profilů, kategorie, stránky a lokality s nabídkami. */
  @Get('sitemap')
  async sitemap() {
    const [listingCount, profiles, cats, lastByCat, pages, locations] = await Promise.all([
      this.prisma.listing.count({ where: { status: { in: [...PUBLIC_STATUSES] } } }),
      this.prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT l."userId")::bigint AS n FROM "Listing" l JOIN "User" u ON u.id = l."userId" WHERE l.status = 'ACTIVE' AND u.status = 'ACTIVE'`,
      this.prisma.category.findMany({ where: { active: true }, select: { id: true, slug: true, parentId: true }, orderBy: { position: 'asc' } }),
      this.prisma.listing.groupBy({ by: ['categoryId'], where: { status: 'ACTIVE' }, _max: { updatedAt: true } }),
      this.prisma.page.findMany({ select: { slug: true, title: true, updatedAt: true }, orderBy: { slug: 'asc' } }),
      this.prisma.$queryRaw<{ cat: string; city: string; n: bigint }[]>`
        SELECT p.slug AS cat, l.city, COUNT(*)::bigint AS n FROM "Listing" l
        JOIN "Category" c ON c.id = l."categoryId" JOIN "Category" p ON p.id = c."parentId"
        WHERE l.status = 'ACTIVE' AND p.active AND c.active GROUP BY p.slug, l.city`,
    ]);
    const last = new Map(lastByCat.map((r) => [r.categoryId, r._max.updatedAt]));
    const parents = cats.filter((c) => !c.parentId);
    const categories = parents.flatMap((p) => {
      const subs = cats.filter((s) => s.parentId === p.id);
      const dates = subs.map((s) => last.get(s.id)).filter((d): d is Date => !!d);
      const max = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
      return [{ path: `/kategorie/${p.slug}`, lastModified: max }, ...subs.map((s) => ({ path: `/kategorie/${p.slug}/${s.slug}`, lastModified: last.get(s.id) ?? null }))];
    });
    const loc = locations.filter((l) => CZ_CITIES.has(l.city)).map((l) => ({ category: l.cat, city: l.city, count: Number(l.n) }));
    const byCity = new Map<string, number>();
    for (const l of loc) byCity.set(l.city, (byCity.get(l.city) ?? 0) + l.count);
    return {
      chunkSize: SITEMAP_CHUNK, listingCount, profileCount: Number(profiles[0]?.n ?? 0),
      categories, pages, locations: loc, cities: [...byCity].map(([city, count]) => ({ city, count })),
    };
  }

  @Get('sitemap/listings')
  async sitemapListings(@Query('chunk') chunk = '0') {
    const n = Math.max(0, Math.floor(Number(chunk) || 0));
    return this.prisma.listing.findMany({ where: { status: { in: [...PUBLIC_STATUSES] } }, select: { id: true, slug: true, updatedAt: true }, orderBy: { id: 'asc' }, skip: n * SITEMAP_CHUNK, take: SITEMAP_CHUNK });
  }

  /** Veřejné profily prodejců s alespoň jedním aktivním inzerátem. */
  @Get('sitemap/profiles')
  async sitemapProfiles(@Query('chunk') chunk = '0') {
    const n = Math.max(0, Math.floor(Number(chunk) || 0));
    const rows = await this.prisma.$queryRaw<{ id: string; updatedAt: Date }[]>`
      SELECT u.id, GREATEST(u."updatedAt", MAX(l."updatedAt")) AS "updatedAt" FROM "User" u JOIN "Listing" l ON l."userId" = u.id
      WHERE l.status = 'ACTIVE' AND u.status = 'ACTIVE' GROUP BY u.id ORDER BY u.id LIMIT ${SITEMAP_CHUNK} OFFSET ${n * SITEMAP_CHUNK}`;
    return rows;
  }

  /** Odstraněný nebo dávno neaktivní inzerát → kam ho přesměrovat (kategorie). */
  @Get('gone/:id')
  async gone(@Param('id') id: string) {
    const l = await this.prisma.listing.findUnique({ where: { id }, select: { status: true, expiresAt: true, updatedAt: true, category: { select: { slug: true, active: true, parent: { select: { slug: true, active: true } } } } } });
    if (!l || !isGone(l)) throw new NotFoundException();
    const c = l.category;
    const path = c.parent ? (c.parent.active ? (c.active ? `/kategorie/${c.parent.slug}/${c.slug}` : `/kategorie/${c.parent.slug}`) : null) : c.active ? `/kategorie/${c.slug}` : null;
    return { gone: true, status: l.status, path };
  }

  /** Přesměrování z tabulky (cache 10 min, negativní 2 min). */
  @Get('redirect')
  async redirect(@Query('path') path = '') {
    const p = normalizePath(path);
    if (!p) throw new NotFoundException();
    const key = `redir:${p}`;
    const cached = await this.redis.get(key);
    let hit: { to: string; code: number } | null;
    if (cached) hit = cached === '-' ? null : JSON.parse(cached);
    else {
      const r = await this.prisma.redirect.findUnique({ where: { from: p } });
      hit = r ? { to: r.to, code: r.code } : null;
      // Bez Redisu (produkce) má každá instance vlastní cache – „nenalezeno“ proto držíme jen krátce,
      // aby nově přidané přesměrování začalo platit do dvou minut
      await this.redis.set(key, hit ? JSON.stringify(hit) : '-', hit ? 600 : 120);
    }
    if (!hit) throw new NotFoundException();
    void this.prisma.redirect.update({ where: { from: p }, data: { hits: { increment: 1 } } }).catch(() => undefined);
    return hit;
  }

  @Get('pages')
  pages() { return this.prisma.page.findMany({ select: { slug: true, title: true, updatedAt: true }, orderBy: { slug: 'asc' } }); }

  /** Úvodní text kategorie (nebo podkategorie). */
  @Get('category')
  async category(@Query('slug') slug = '', @Query('sub') sub?: string) {
    const parent = await this.prisma.category.findFirst({ where: { slug, parentId: null, active: true }, select: { id: true, intro: true } });
    if (!parent) throw new NotFoundException();
    if (!sub) return { intro: parent.intro };
    const s = await this.prisma.category.findFirst({ where: { slug: sub, parentId: parent.id, active: true }, select: { intro: true } });
    if (!s) throw new NotFoundException();
    return { intro: s.intro };
  }

  /** Počty aktivních inzerátů podle měst (pro odkazy na lokality). */
  @Get('cities')
  async cities(@Query('kategorie') cat?: string, @Query('pod') sub?: string) {
    const where = { status: 'ACTIVE' as const, ...(cat ? { category: sub ? { slug: sub, parent: { slug: cat } } : { parent: { slug: cat } } } : {}) };
    const rows = await this.prisma.listing.groupBy({ by: ['city'], where, _count: true });
    return rows.filter((r) => CZ_CITIES.has(r.city)).map((r) => ({ city: r.city, count: r._count })).sort((a, b) => b.count - a.count);
  }
}

/** Administrace SEO: přesměrování, úvodní texty kategorií, metadata informačních stránek. */
@Controller('admin/seo')
export class SeoAdminController {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  private audit(u: AuthUser, action: string, targetId: string, meta?: object) {
    return this.prisma.auditLog.create({ data: { actorId: u.id, action, targetType: 'seo', targetId, meta } });
  }

  @Can('pages.edit')
  @Get('redirects')
  redirects() { return this.prisma.redirect.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }); }

  @Can('pages.edit')
  @Post('redirects')
  async addRedirect(@CurrentUser() u: AuthUser, @Body(new ZodPipe(RedirectDto)) dto: { from: string; to: string; code: number }) {
    const r = await this.prisma.redirect.upsert({ where: { from: dto.from }, create: dto, update: { to: dto.to, code: dto.code } });
    await this.redis.del(`redir:${dto.from}`);
    await this.audit(u, 'redirect.save', dto.from, dto);
    return r;
  }

  @Can('pages.edit')
  @Delete('redirects')
  async deleteRedirect(@CurrentUser() u: AuthUser, @Query('from') from = '') {
    const p = normalizePath(from);
    if (!p) throw new NotFoundException();
    await this.prisma.redirect.deleteMany({ where: { from: p } });
    await this.redis.del(`redir:${p}`);
    await this.audit(u, 'redirect.delete', p);
    return { ok: true };
  }

  @Can('pages.edit')
  @Get('categories')
  async categories() {
    const rows = await this.prisma.category.findMany({ select: { id: true, slug: true, name: true, parentId: true, intro: true, active: true }, orderBy: [{ position: 'asc' }] });
    return rows.filter((c) => !c.parentId).map((c) => ({ ...c, children: rows.filter((s) => s.parentId === c.id) }));
  }

  @Can('categories.manage')
  @Put('categories/:id')
  async saveIntro(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ intro: z.string().trim().max(5000).nullable() }))) dto: { intro: string | null }) {
    await this.prisma.category.update({ where: { id }, data: { intro: dto.intro || null } });
    await this.audit(u, 'category.intro', id);
    return { ok: true };
  }

  @Can('pages.edit')
  @Put('pages/:slug')
  async savePageMeta(@Param('slug') slug: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(PageMetaDto)) dto: z.infer<typeof PageMetaDto>) {
    const p = await this.prisma.page.findUnique({ where: { slug } });
    if (!p) throw new NotFoundException();
    await this.prisma.page.update({ where: { slug }, data: { description: dto.description || null, effectiveFrom: toDate(dto.effectiveFrom), reviewedAt: toDate(dto.reviewedAt), updatedAt: p.updatedAt } });
    await this.audit(u, 'page.meta', slug, dto);
    return { ok: true };
  }
}
