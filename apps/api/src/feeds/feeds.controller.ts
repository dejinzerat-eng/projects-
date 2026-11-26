import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { isValidIco, normalizeIco } from '@dej/shared';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { AuthUser, CurrentUser } from '../common/auth.guard';
import { config } from '../common/config';
import { Can } from '../common/permissions';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { cleanEmail, normalizePhone } from '../legacy/legacy-map';
import { ATTR_FIELDS, CORE_FIELDS, FIELD_LABEL, type FieldMap } from './feed-map';
import { FeedParseError } from './feed-parse';
import { asCategoryMap, asFieldMap, FeedImportService, type FeedSettings } from './feed-import.service';
import { checkUrl } from './feed-source';

const FIELD_KEYS = [...CORE_FIELDS, ...ATTR_FIELDS] as [string, ...string[]];
const Url = z.string().trim().min(8, 'Zadejte adresu feedu.').max(2000).refine((u) => /^https?:\/\//i.test(u), 'Adresa feedu musí začínat https:// nebo http://.');
const Settings = z.object({
  name: z.string().trim().min(2, 'Zadejte název partnera.').max(120),
  url: Url,
  format: z.enum(['auto', 'heureka', 'google', 'generic']).default('auto'),
  fieldMap: z.partialRecord(z.enum(FIELD_KEYS), z.array(z.string().max(300)).max(10)).default({}),
  categoryMap: z.record(z.string().max(300), z.string().max(40)).default({}),
  defaultCategoryId: z.string().max(40).nullable().default(null),
  defaultCity: z.string().trim().max(80).nullable().default(null),
  defaultZip: z.string().trim().max(10).nullable().default(null).transform((v) => (v ? v.replace(/\s/g, '') : null)).refine((v) => !v || /^\d{5}$/.test(v), 'PSČ má 5 číslic.'),
  requireApproval: z.boolean().default(true),
  intervalHours: z.number().int().refine((h) => [0, 6, 12, 24, 48, 168].includes(h), 'Neplatný interval.').default(24),
  maxItems: z.number().int().min(1).max(10_000).default(1000),
  active: z.boolean().default(true),
});
const CreateDto = Settings.extend({
  account: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('existing'), email: z.string().trim().max(254) }),
    z.object({
      mode: z.literal('new'), email: z.string().trim().max(254), companyName: z.string().trim().min(2, 'Zadejte název firmy.').max(120),
      companyId: z.string().trim().max(20).optional(), phone: z.string().trim().max(30).optional(), city: z.string().trim().max(80).optional(),
    }),
  ]),
});
const PreviewDto = Settings.partial({ name: true }).extend({ feedId: z.string().max(40).optional() });
const SyncDto = z.object({ skip: z.array(z.string().max(120)).max(5000).default([]) });
const DeleteDto = z.object({ listings: z.enum(['expire', 'keep']) });

const toSettings = (d: z.infer<typeof PreviewDto>): FeedSettings => ({
  url: d.url, format: d.format, fieldMap: asFieldMap(d.fieldMap) as FieldMap, categoryMap: asCategoryMap(d.categoryMap), defaultCategoryId: d.defaultCategoryId,
  defaultCity: d.defaultCity, defaultZip: d.defaultZip, maxItems: d.maxItems, requireApproval: d.requireApproval,
});

/** Partneři s XML importem (administrace) – správce obchodních účtů a administrátoři (businesses.manage). */
@Controller('admin/feeds')
export class FeedsAdminController {
  constructor(private prisma: PrismaService, private feeds: FeedImportService, private auth: AuthService) {}

  private async assertUrl(url: string) {
    try { await checkUrl(url); } catch (e) { throw new BadRequestException({ message: (e as Error).message, field: 'url' }); }
  }

  private async countsByFeed(ids: string[]) {
    const rows = await this.prisma.listing.groupBy({ by: ['feedId', 'status'], where: { feedId: { in: ids } }, _count: true });
    const out = new Map<string, Record<string, number>>();
    for (const r of rows) { const m = out.get(r.feedId!) ?? {}; m[r.status] = r._count; out.set(r.feedId!, m); }
    return out;
  }

  @Can('businesses.manage')
  @Get()
  async list() {
    const feeds = await this.prisma.partnerFeed.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, email: true, name: true, companyName: true } } } });
    const counts = await this.countsByFeed(feeds.map((f) => f.id));
    return feeds.map((f) => ({ ...f, fieldMap: undefined, categoryMap: undefined, counts: counts.get(f.id) ?? {} }));
  }

  /** Údaje pro formuláře: podkategorie, pole k přiřazení a stav e-mailů. */
  @Can('businesses.manage')
  @Get('meta')
  async meta() {
    const cats = await this.feeds.categories();
    return {
      categories: cats.map((c) => ({ id: c.id, label: c.label, parentSlug: c.parentSlug })),
      fields: [...CORE_FIELDS, ...ATTR_FIELDS].map((k) => ({ key: k, label: FIELD_LABEL[k], attr: (ATTR_FIELDS as readonly string[]).includes(k) })),
      mailReady: !!config.resendKey,
    };
  }

  @Can('businesses.manage')
  @Get(':id')
  async detail(@Param('id') id: string) {
    const f = await this.prisma.partnerFeed.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true, companyName: true, companyId: true, companyVerifiedAt: true, passwordHash: true, googleId: true, partnerInvitedAt: true, status: true } }, runs: { orderBy: { startedAt: 'desc' }, take: 15 } },
    });
    if (!f) throw new NotFoundException('Partner neexistuje.');
    const counts = (await this.countsByFeed([id])).get(id) ?? {};
    const { passwordHash, googleId, ...user } = f.user;
    return { ...f, user: { ...user, claimed: !!(passwordHash || googleId), invalidEmail: user.email.endsWith('.invalid') }, counts };
  }

  @Can('businesses.manage')
  @Post()
  async create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(CreateDto)) dto: z.infer<typeof CreateDto>) {
    await this.assertUrl(dto.url);
    const email = cleanEmail(dto.account.email);
    if (!email) throw new BadRequestException({ message: 'Zadejte platný e-mail partnera.', field: 'email' });
    let userId: string;
    const found = await this.prisma.user.findUnique({ where: { email } });
    if (dto.account.mode === 'existing') {
      if (!found) throw new BadRequestException({ message: 'Účet s tímto e-mailem neexistuje. Zvolte „Založit nový firemní účet“.', field: 'email' });
      if (found.status === 'BLOCKED') throw new BadRequestException({ message: 'Účet je zablokovaný.', field: 'email' });
      userId = found.id;
    } else {
      if (found) throw new BadRequestException({ message: 'Účet s tímto e-mailem už existuje – zvolte „Existující účet“.', field: 'email' });
      const ico = dto.account.companyId ? normalizeIco(dto.account.companyId) : null;
      if (ico && !isValidIco(ico)) throw new BadRequestException({ message: 'Neplatné IČO – nesedí kontrolní číslice.', field: 'companyId' });
      const created = await this.prisma.user.create({
        data: {
          email, name: dto.account.companyName, isBusiness: true, companyName: dto.account.companyName, companyId: ico,
          phone: normalizePhone(dto.account.phone), city: dto.account.city || dto.defaultCity || null, showPhone: false,
        },
      });
      userId = created.id;
      await this.prisma.auditLog.create({ data: { actorId: u.id, action: 'feed.partner_account', targetType: 'user', targetId: userId, meta: { email, companyName: dto.account.companyName, ico } } });
    }
    const { account: _a, ...settings } = dto;
    const feed = await this.prisma.partnerFeed.create({ data: { ...settings, fieldMap: settings.fieldMap as Prisma.InputJsonValue, categoryMap: settings.categoryMap, userId } });
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: 'feed.create', targetType: 'feed', targetId: feed.id, meta: { name: feed.name, url: feed.url, userId } } });
    return { id: feed.id };
  }

  @Can('businesses.manage')
  @Patch(':id')
  async update(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(Settings.partial())) dto: Partial<z.infer<typeof Settings>>) {
    const f = await this.prisma.partnerFeed.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Partner neexistuje.');
    if (dto.url && dto.url !== f.url) await this.assertUrl(dto.url);
    const data: Prisma.PartnerFeedUpdateInput = { ...dto, fieldMap: dto.fieldMap as Prisma.InputJsonValue | undefined };
    // Zapnutý interval → další synchronizace podle nového nastavení
    if (dto.intervalHours !== undefined && dto.intervalHours !== f.intervalHours) data.nextSyncAt = dto.intervalHours > 0 ? new Date((f.lastSyncAt?.getTime() ?? Date.now()) + dto.intervalHours * 3600_000 - 15 * 60_000) : null;
    await this.prisma.partnerFeed.update({ where: { id }, data });
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: 'feed.update', targetType: 'feed', targetId: id, meta: { fields: Object.keys(dto) } } });
    return { ok: true };
  }

  @Can('businesses.manage')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(DeleteDto)) dto: z.infer<typeof DeleteDto>) {
    const f = await this.prisma.partnerFeed.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Partner neexistuje.');
    let expired = 0;
    if (dto.listings === 'expire') {
      const ids = (await this.prisma.listing.findMany({ where: { feedId: id }, select: { id: true } })).map((l) => l.id);
      expired = await this.feeds.expire(ids);
    }
    await this.prisma.partnerFeed.delete({ where: { id } });
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: 'feed.delete', targetType: 'feed', targetId: id, meta: { name: f.name, listings: dto.listings, expired } } });
    return { ok: true, expired };
  }

  /** Náhled feedu s rozpracovaným nastavením (nic neukládá). */
  @Can('businesses.manage')
  @Post('preview')
  async preview(@Body(new ZodPipe(PreviewDto)) dto: z.infer<typeof PreviewDto>) {
    await this.assertUrl(dto.url);
    try { return await this.feeds.preview(toSettings(dto), dto.feedId); } catch (e) {
      if (e instanceof FeedParseError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  /** Jedna dávka synchronizace (web volá opakovaně, dokud done = false). */
  @Can('businesses.manage')
  @Post(':id/sync')
  async sync(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(SyncDto)) dto: z.infer<typeof SyncDto>) {
    return this.feeds.sync(id, 'manual', { actorId: u.id, skip: dto.skip });
  }

  @Can('businesses.manage')
  @Post(':id/approve-pending')
  approve(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.feeds.approvePending(id, u.id); }

  @Can('businesses.manage')
  @Post(':id/expire-missing')
  expireMissing(@Param('id') id: string, @CurrentUser() u: AuthUser) { return this.feeds.expireMissing(id, u.id); }

  /** Pozvánka partnerovi: odkaz na nastavení hesla k firemnímu účtu. */
  @Can('businesses.manage')
  @Post(':id/invite')
  async invite(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    if (!config.resendKey) throw new BadRequestException('Odesílání e-mailů zatím není nastavené (chybí klíč Resend). Pozvánku pošlete po připojení domény a e-mailu.');
    const f = await this.prisma.partnerFeed.findUnique({ where: { id }, include: { user: true } });
    if (!f) throw new NotFoundException('Partner neexistuje.');
    if (f.user.passwordHash || f.user.googleId || f.user.appleId) throw new BadRequestException('Partner už má k účtu přístup (heslo nebo Google).');
    if (f.user.email.endsWith('.invalid')) throw new BadRequestException('Účet nemá platný e-mail.');
    const n = await this.prisma.listing.count({ where: { userId: f.userId, status: 'ACTIVE' } });
    await this.auth.sendPartnerInvite(f.user, n);
    await this.prisma.user.update({ where: { id: f.userId }, data: { partnerInvitedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: 'feed.invite', targetType: 'feed', targetId: id, meta: { email: f.user.email } } });
    return { ok: true };
  }
}

