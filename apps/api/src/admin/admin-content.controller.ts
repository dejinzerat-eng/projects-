import { BadRequestException, Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../common/auth.guard';
import { Can } from '../common/permissions';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { RedisService } from '../common/redis.service';
import { SearchService } from '../search/search.service';
import { saveRedirects } from '../seo/seo.controller';
import { categoryRedirects } from '../seo/seo.logic';
import { audit, diff } from './audit';
import { SettingsService, SystemSettingsDto } from './settings.service';

const slug = z.string().trim().min(2, 'Adresa musí mít alespoň 2 znaky.').max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Adresa smí obsahovat jen malá písmena bez diakritiky, číslice a pomlčky.');
const FilterDef = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/, 'Klíč filtru: písmena a číslice bez mezer.'), label: z.string().trim().min(1).max(60),
  type: z.enum(['select', 'multiselect', 'range', 'boolean']), options: z.array(z.string().trim().min(1).max(60)).max(200).optional(),
  unit: z.string().max(20).optional(), min: z.number().optional(), max: z.number().optional(),
}).refine((f) => !['select', 'multiselect'].includes(f.type) || (f.options?.length ?? 0) > 0, { message: 'Výběrový filtr potřebuje možnosti.' });
const CategoryUpdate = z.object({
  name: z.string().trim().min(2).max(80), slug: slug.optional(), active: z.boolean(), position: z.number().int().min(0).max(100_000),
  icon: z.string().trim().max(40).nullable().optional(), parentId: z.string().nullable().optional(),
  seoTitle: z.string().max(120).nullable().optional(), seoDescription: z.string().max(300).nullable().optional(),
  filters: z.array(FilterDef).max(40).optional(),
});
const CategoryCreate = z.object({ name: z.string().trim().min(2).max(80), slug, parentId: z.string().nullable(), icon: z.string().trim().max(40).nullable().optional() });
const PriceDto = z.object({ name: z.string().trim().min(2).max(120), description: z.string().max(500).nullable().optional(), priceCzk: z.number().int().min(0).max(1_000_000), durationDays: z.number().int().min(0).max(3650).nullable().optional(), active: z.boolean() });
const PageDto = z.object({ title: z.string().trim().min(2, 'Zadejte titulek.').max(160), content: z.string().max(100_000) });

/** Stránky, které odkazuje patička a právní texty – nelze je smazat (jen upravit). */
export const SYSTEM_PAGES = ['podminky', 'ochrana-udaju', 'bezpecny-nakup', 'napoveda', 'kontakt'];

/** Kategorie, ceník, informační stránky a systémová nastavení. */
@Controller('admin')
export class AdminContentController {
  constructor(private prisma: PrismaService, private search: SearchService, private settings: SettingsService, private redis: RedisService) {}

  private async reindexCategory(ids: string[]) {
    const ls = await this.prisma.listing.findMany({ where: { categoryId: { in: ids } }, select: { id: true } });
    if (ls.length > 300) await this.search.reindexAll();
    else for (const l of ls) await this.search.index(l.id);
  }

  /** Slug musí být jedinečný mezi sourozenci (u hlavních kategorií to databáze sama nehlídá). */
  private async assertSlugFree(slugValue: string, parentId: string | null, exceptId?: string) {
    const clash = await this.prisma.category.findFirst({ where: { slug: slugValue, parentId, ...(exceptId ? { id: { not: exceptId } } : {}) } });
    if (clash) throw new ConflictException(`Adresa „${slugValue}“ už v této úrovni existuje.`);
  }

  private async assertParent(parentId: string | null, selfId?: string) {
    if (!parentId) return;
    if (parentId === selfId) throw new BadRequestException('Kategorie nemůže být sama sobě nadřazená.');
    const p = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!p) throw new BadRequestException('Nadřazená kategorie neexistuje.');
    if (p.parentId) throw new BadRequestException('Podkategorie může být jen pod hlavní kategorií (nejvýše 2 úrovně).');
  }

  @Can('categories.manage')
  @Get('categories')
  categories() {
    return this.prisma.category.findMany({ orderBy: [{ parentId: 'asc' }, { position: 'asc' }], include: { _count: { select: { listings: true, children: true } } } });
  }

  @Can('categories.manage')
  @Post('categories')
  async createCategory(@CurrentUser() u: AuthUser, @Body(new ZodPipe(CategoryCreate)) dto: z.infer<typeof CategoryCreate>) {
    await this.assertParent(dto.parentId);
    await this.assertSlugFree(dto.slug, dto.parentId);
    const last = await this.prisma.category.aggregate({ where: { parentId: dto.parentId }, _max: { position: true } });
    const c = await this.prisma.category.create({ data: { ...dto, position: (last._max.position ?? -1) + 1 } });
    await audit(this.prisma, u, 'category.create', 'category', c.id, dto);
    return c;
  }

  /** Úprava včetně přesunu pod jinou nadřazenou kategorii (parentId) a pořadí. */
  @Can('categories.manage')
  @Put('categories/:id')
  async saveCategory(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(CategoryUpdate)) dto: z.infer<typeof CategoryUpdate>) {
    const c = await this.prisma.category.findUnique({ where: { id }, include: { _count: { select: { children: true } } } });
    if (!c) throw new NotFoundException('Kategorie neexistuje.');
    const parentId = dto.parentId === undefined ? c.parentId : dto.parentId;
    const moved = parentId !== c.parentId;
    if (moved) {
      await this.assertParent(parentId, id);
      if (parentId && c._count.children) throw new BadRequestException('Kategorii s podkategoriemi nelze vnořit pod jinou (nejvýše 2 úrovně).');
    }
    if (moved || (dto.slug && dto.slug !== c.slug)) await this.assertSlugFree(dto.slug ?? c.slug, parentId, id);
    // Přesunutá kategorie se zařadí na konec nové úrovně (pokud pořadí výslovně nezměnili)
    const position = moved && dto.position === c.position ? ((await this.prisma.category.aggregate({ where: { parentId }, _max: { position: true } }))._max.position ?? -1) + 1 : dto.position;
    const data = { ...dto, parentId, position, filters: dto.filters as Prisma.InputJsonValue | undefined };
    const changes = diff(c as unknown as Record<string, unknown>, data as Record<string, unknown>);
    const children = await this.prisma.category.findMany({ where: { parentId: id }, select: { id: true, slug: true } });
    // Změněná adresa výpisu → trvalé přesměrování ze staré adresy (i pro podkategorie), viz Správa SEO
    const slugOf = async (pid: string | null) => (pid ? (await this.prisma.category.findUnique({ where: { id: pid }, select: { slug: true } }))?.slug ?? null : null);
    const redirects = moved || changes.slug
      ? categoryRedirects({ slug: c.slug, parentSlug: await slugOf(c.parentId) }, { slug: dto.slug ?? c.slug, parentSlug: await slugOf(parentId) }, children.map((x) => x.slug))
      : [];
    await this.prisma.category.update({ where: { id }, data });
    await saveRedirects(this.prisma, this.redis, redirects);
    if (moved || changes.slug || changes.name || changes.active) await this.reindexCategory([id, ...children.map((x) => x.id)]);
    await audit(this.prisma, u, moved ? 'category.move' : 'category.update', 'category', id, { changes, ...(redirects.length ? { redirects } : {}) });
    return { ok: true, redirects: redirects.length };
  }

  /** Posun v pořadí mezi sourozenci. */
  @Can('categories.manage')
  @Post('categories/:id/move')
  async moveCategory(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ direction: z.enum(['up', 'down']) }))) dto: { direction: 'up' | 'down' }) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Kategorie neexistuje.');
    const siblings = await this.prisma.category.findMany({ where: { parentId: c.parentId }, orderBy: [{ position: 'asc' }, { name: 'asc' }], select: { id: true } });
    const i = siblings.findIndex((s) => s.id === id), j = dto.direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= siblings.length) return { ok: true };
    [siblings[i], siblings[j]] = [siblings[j], siblings[i]];
    await this.prisma.$transaction(siblings.map((s, position) => this.prisma.category.update({ where: { id: s.id }, data: { position } })));
    await audit(this.prisma, u, 'category.reorder', 'category', id, { direction: dto.direction });
    return { ok: true };
  }

  /** Smazání jen prázdné kategorie, nebo s přesunem inzerátů do jiné (?moveTo=). */
  @Can('categories.manage')
  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string, @CurrentUser() u: AuthUser, @Query('moveTo') moveTo?: string) {
    const c = await this.prisma.category.findUnique({ where: { id }, include: { _count: { select: { children: true, listings: true } } } });
    if (!c) throw new NotFoundException('Kategorie neexistuje.');
    if (c._count.children) throw new ConflictException('Nejdříve přesuňte nebo smažte podkategorie.');
    let moved: string[] = [];
    if (c._count.listings) {
      if (!moveTo) throw new ConflictException(`V kategorii jsou inzeráty (${c._count.listings}). Vyberte, kam je přesunout.`);
      const target = await this.prisma.category.findUnique({ where: { id: moveTo }, include: { _count: { select: { children: true } } } });
      if (!target || target.id === id) throw new BadRequestException('Cílová kategorie neexistuje.');
      if (target._count.children || !target.parentId) throw new BadRequestException('Inzeráty lze přesunout jen do podkategorie.');
      moved = (await this.prisma.listing.findMany({ where: { categoryId: id }, select: { id: true } })).map((l) => l.id);
      await this.prisma.listing.updateMany({ where: { categoryId: id }, data: { categoryId: moveTo } });
    }
    await this.prisma.category.delete({ where: { id } });
    if (moved.length > 300) await this.search.reindexAll(); else for (const l of moved) await this.search.index(l);
    await audit(this.prisma, u, 'category.delete', 'category', id, { name: c.name, slug: c.slug, parentId: c.parentId, movedListings: moved.length, moveTo: moveTo ?? null });
    return { ok: true, moved: moved.length };
  }

  // ——— Ceník ———

  @Can('prices.edit')
  @Get('prices')
  prices() { return this.prisma.priceItem.findMany({ orderBy: { priceCzk: 'asc' } }); }

  @Can('prices.edit')
  @Put('prices/:code')
  async savePrice(@Param('code') code: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(PriceDto)) dto: z.infer<typeof PriceDto>) {
    if (!/^[A-Z0-9_]{2,40}$/.test(code)) throw new BadRequestException('Kód služby: velká písmena, číslice a podtržítko (např. TOP_14).');
    const before = await this.prisma.priceItem.findUnique({ where: { code } });
    await this.prisma.priceItem.upsert({ where: { code }, create: { code, ...dto }, update: dto });
    await audit(this.prisma, u, before ? 'price.update' : 'price.create', 'price', code, before ? { changes: diff(before as unknown as Record<string, unknown>, dto) } : dto);
    return { ok: true };
  }

  // ——— Stránky ———

  @Can('pages.edit')
  @Get('pages')
  async pages() {
    const rows = await this.prisma.page.findMany({ orderBy: { slug: 'asc' } });
    return rows.map((p) => ({ ...p, system: SYSTEM_PAGES.includes(p.slug) }));
  }

  @Can('pages.edit')
  @Post('pages')
  async createPage(@CurrentUser() u: AuthUser, @Body(new ZodPipe(PageDto.extend({ slug }))) dto: { slug: string; title: string; content: string }) {
    if (await this.prisma.page.findUnique({ where: { slug: dto.slug } })) throw new ConflictException('Stránka s touto adresou už existuje.');
    await this.prisma.page.create({ data: dto });
    await audit(this.prisma, u, 'page.create', 'page', dto.slug, { title: dto.title });
    return { ok: true, slug: dto.slug };
  }

  @Can('pages.edit')
  @Put('pages/:slug')
  async savePage(@Param('slug') pageSlug: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(PageDto)) dto: { title: string; content: string }) {
    if (!slug.safeParse(pageSlug).success) throw new BadRequestException('Neplatná adresa stránky.');
    const before = await this.prisma.page.findUnique({ where: { slug: pageSlug } });
    await this.prisma.page.upsert({ where: { slug: pageSlug }, create: { slug: pageSlug, ...dto }, update: dto });
    // Předchozí verze zůstane v auditním logu (lze ji obnovit ručně)
    await audit(this.prisma, u, before ? 'page.update' : 'page.create', 'page', pageSlug, before ? { previousTitle: before.title, previousContent: before.content.slice(0, 20_000) } : { title: dto.title });
    return { ok: true };
  }

  @Can('pages.edit')
  @Delete('pages/:slug')
  async deletePage(@Param('slug') pageSlug: string, @CurrentUser() u: AuthUser) {
    if (SYSTEM_PAGES.includes(pageSlug)) throw new BadRequestException('Systémovou stránku nelze smazat, jen upravit.');
    const p = await this.prisma.page.findUnique({ where: { slug: pageSlug } });
    if (!p) throw new NotFoundException('Stránka neexistuje.');
    await this.prisma.page.delete({ where: { slug: pageSlug } });
    await audit(this.prisma, u, 'page.delete', 'page', pageSlug, { title: p.title, content: p.content.slice(0, 20_000) });
    return { ok: true };
  }

  // ——— Systémová nastavení ———

  @Can('settings.manage')
  @Get('settings')
  getSettings() { return this.settings.all(); }

  @Can('settings.manage')
  @Put('settings')
  async saveSettings(@CurrentUser() u: AuthUser, @Body(new ZodPipe(SystemSettingsDto)) dto: z.infer<typeof SystemSettingsDto>) {
    const { changed, settings } = await this.settings.update(dto);
    if (Object.keys(changed).length) await audit(this.prisma, u, 'settings.update', 'settings', 'system', { changes: changed });
    return settings;
  }
}

/** Veřejná nastavení (kontakt na podporu, identifikace provozovatele) pro patičku a právní stránky. */
@Controller('settings')
export class PublicSettingsController {
  constructor(private settings: SettingsService) {}
  @Get('public')
  publicSettings() { return this.settings.publicSettings(); }
}
