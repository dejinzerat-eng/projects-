import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { Auth, AuthUser, CurrentUser, Roles } from '../common/auth.guard';
import { verifyCaptcha } from '../common/captcha';
import { config } from '../common/config';
import { MailerService } from '../common/mailer.service';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { SearchService } from '../search/search.service';
import {
  AppealDto, DecideAppealDto, DecideNoticeDto, esc, listingIdFrom, makeRef, NOTICE_CATEGORIES, NoticeCategory, NoticeDto, NoticeInput, parseTarget, transparencySummary,
} from './notice.logic';
import { operatorFromEnv } from './operator';

const STATUS_TEXT = { RECEIVED: 'Přijato, čeká na posouzení', ACTION_TAKEN: 'Vyřízeno – obsah byl omezen', NO_ACTION: 'Vyřízeno – bez zásahu' } as const;
const mail = (title: string, body: string) => `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#1b1f24"><h2 style="font-size:20px">${title}</h2>${body}<p style="color:#69717a;font-size:13px;margin-top:24px">${esc(operatorFromEnv().name)} · Dejinzerat.cz · <a href="${config.webOrigin}/stranka/nahlasovani-obsahu">Jak vyřizujeme oznámení</a></p></div>`;

/** Veřejná část: oznámení nezákonného obsahu (čl. 16 DSA) a námitky proti rozhodnutí moderace (čl. 20 DSA). */
@Controller()
export class NoticesController {
  constructor(private prisma: PrismaService, private mailer: MailerService) {}

  @Get('notices/categories')
  categories() { return Object.entries(NOTICE_CATEGORIES).map(([value, label]) => ({ value, label, anonymous: value === 'ZNEUZITI_DETI' })); }

  @Auth('optional')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('notices')
  async create(@Body(new ZodPipe(NoticeDto)) dto: NoticeInput, @CurrentUser() u: AuthUser | undefined, @Req() req: Request) {
    await verifyCaptcha(dto.captcha, req.ip);
    const target = parseTarget(dto.targetUrl);
    let notice;
    for (let attempt = 0; ; attempt++) {
      try {
        notice = await this.prisma.illegalContentNotice.create({
          data: {
            ref: makeRef('DSA'), category: dto.category, targetUrl: dto.targetUrl, targetType: target?.targetType, targetId: target?.targetId,
            explanation: dto.explanation, reporterName: dto.name || null, reporterEmail: dto.email?.toLowerCase() || null, reporterUserId: u?.id ?? null, goodFaith: true,
          },
        });
        break;
      } catch (e) {
        if (attempt < 3 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    if (notice.reporterEmail) {
      await this.mailer.send(notice.reporterEmail, `Potvrzení o přijetí oznámení ${notice.ref}`, mail('Vaše oznámení jsme přijali', `
        <p>Děkujeme. Oznámení o možném nezákonném obsahu jsme přijali <b>${notice.createdAt.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}</b> pod číslem <b>${notice.ref}</b>.</p>
        <p><b>Druh obsahu:</b> ${esc(NOTICE_CATEGORIES[notice.category as NoticeCategory])}<br><b>Adresa:</b> ${esc(notice.targetUrl)}</p>
        <p>Oznámení posoudíme bez zbytečného odkladu, nestranně a s péčí. O rozhodnutí a jeho důvodech vás budeme informovat na tento e-mail.</p>`));
    }
    return { ref: notice.ref, createdAt: notice.createdAt, emailSent: !!notice.reporterEmail };
  }

  @Auth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('appeals')
  async appeal(@CurrentUser() u: AuthUser, @Body(new ZodPipe(AppealDto)) dto: z.infer<typeof AppealDto>) {
    const id = listingIdFrom(dto.listing);
    const l = id ? await this.prisma.listing.findUnique({ where: { id } }) : null;
    if (!l) throw new NotFoundException('Inzerát jsme nenašli. Vložte odkaz na inzerát nebo jeho ID.');
    if (l.userId !== u.id) throw new ForbiddenException('Námitku může podat jen autor inzerátu.');
    if (!(await this.moderated(l))) throw new BadRequestException('Námitku lze podat jen proti rozhodnutí moderace (zamítnutý nebo stažený inzerát).');
    if (await this.prisma.moderationAppeal.findFirst({ where: { listingId: l.id, status: 'OPEN' } })) throw new BadRequestException('K tomuto inzerátu už námitku vyřizujeme.');
    const a = await this.prisma.moderationAppeal.create({ data: { ref: makeRef('NAM'), listingId: l.id, userId: u.id, text: dto.text } });
    await this.mailer.send(u.email, `Námitka ${a.ref} přijata`, mail('Vaši námitku jsme přijali', `<p>Námitku proti rozhodnutí o inzerátu „${esc(l.title)}“ vyřizujeme pod číslem <b>${a.ref}</b>. Posoudí ji jiný člen týmu než ten, kdo rozhodoval původně, a výsledek vám pošleme e-mailem.</p>`));
    return { ref: a.ref, createdAt: a.createdAt };
  }

  /** Inzerát stáhla moderace (ne sám autor): zamítnutý, nebo smazaný s důvodem či záznamem moderátora v auditním logu. */
  private async moderated(l: { id: string; status: string; rejectReason: string | null }) {
    if (l.status === 'REJECTED') return true;
    if (l.status !== 'DELETED') return false;
    if (l.rejectReason) return true;
    return !!(await this.prisma.auditLog.findFirst({ where: { targetType: 'listing', targetId: l.id, action: { in: ['listing.delete', 'listing.reject'] } } }));
  }

  /** Moje inzeráty stažené moderací, proti kterým lze podat námitku. */
  @Auth()
  @Get('appeals/eligible')
  async eligible(@CurrentUser() u: AuthUser) {
    const candidates = await this.prisma.listing.findMany({ where: { userId: u.id, status: { in: ['REJECTED', 'DELETED'] } }, select: { id: true, title: true, status: true, rejectReason: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 100 });
    const rows = [];
    for (const r of candidates) if (await this.moderated(r)) rows.push(r);
    const appeals = await this.prisma.moderationAppeal.findMany({ where: { listingId: { in: rows.map((r) => r.id) } }, select: { listingId: true, status: true, ref: true }, orderBy: { createdAt: 'desc' } });
    return rows.slice(0, 50).map((r) => ({ ...r, appeal: appeals.find((a) => a.listingId === r.id) ?? null }));
  }
}

/** Administrace oznámení a námitek. */
@Controller('admin')
export class NoticesAdminController {
  constructor(private prisma: PrismaService, private mailer: MailerService, private search: SearchService) {}

  @Roles('MODERATOR')
  @Get('notices')
  async list(@Query('status') status = 'RECEIVED') {
    const st = ['RECEIVED', 'ACTION_TAKEN', 'NO_ACTION'].includes(status) ? (status as 'RECEIVED') : undefined;
    const rows = await this.prisma.illegalContentNotice.findMany({ where: st ? { status: st } : {}, orderBy: { createdAt: st === 'RECEIVED' ? 'asc' : 'desc' }, take: 200 });
    const listings = await this.prisma.listing.findMany({ where: { id: { in: rows.filter((r) => r.targetType === 'LISTING').map((r) => r.targetId!) } }, select: { id: true, slug: true, title: true, status: true } });
    return rows.map((r) => ({ ...r, categoryLabel: NOTICE_CATEGORIES[r.category as NoticeCategory] ?? r.category, listing: listings.find((l) => l.id === r.targetId) ?? null }));
  }

  @Roles('MODERATOR')
  @Get('notices/stats')
  async stats(@Query('rok') year?: string) {
    const y = Number(year) || new Date().getFullYear();
    const rows = await this.prisma.illegalContentNotice.findMany({ where: { createdAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } }, select: { category: true, status: true, createdAt: true, decidedAt: true } });
    const [appeals, appealsUpheld] = await Promise.all([
      this.prisma.moderationAppeal.count({ where: { createdAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } } }),
      this.prisma.moderationAppeal.count({ where: { status: 'UPHELD', createdAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } } }),
    ]);
    return { year: y, ...transparencySummary(rows), appeals, appealsUpheld, categories: NOTICE_CATEGORIES };
  }

  @Roles('MODERATOR')
  @Post('notices/:id/decide')
  async decide(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(DecideNoticeDto)) dto: z.infer<typeof DecideNoticeDto>) {
    const n = await this.prisma.illegalContentNotice.findUnique({ where: { id } });
    if (!n) throw new NotFoundException();
    if (n.status !== 'RECEIVED') throw new BadRequestException('Oznámení už bylo vyřízeno.');
    const action = dto.status === 'NO_ACTION' ? 'none' : dto.action;
    if (action !== 'none') {
      if (n.targetType !== 'LISTING' || !n.targetId) throw new BadRequestException('Opatření lze automaticky provést jen u inzerátu. U jiného obsahu zvolte „bez automatického zásahu“ a zasáhněte ručně.');
      const l = await this.prisma.listing.findUnique({ where: { id: n.targetId } });
      if (!l) throw new BadRequestException('Inzerát už neexistuje.');
      const status = action === 'delete' ? 'DELETED' : 'REJECTED';
      await this.prisma.listing.update({ where: { id: l.id }, data: { status, rejectReason: dto.reason } });
      await this.search.index(l.id);
      // Odůvodnění pro autora obsahu (čl. 17 DSA) včetně možnosti podat námitku
      await this.prisma.notification.create({ data: { userId: l.userId, type: 'moderation', title: `Inzerát „${l.title}“ byl ${action === 'delete' ? 'odstraněn' : 'stažen'}`, body: `${dto.reason} Nesouhlasíte? Podejte námitku.`, link: `/namitka?inzerat=${l.id}` } });
      const owner = await this.prisma.user.findUnique({ where: { id: l.userId }, select: { email: true } });
      if (owner) await this.mailer.send(owner.email, `Rozhodnutí o inzerátu „${l.title}“`, mail(`Inzerát byl ${action === 'delete' ? 'odstraněn' : 'stažen ze zveřejnění'}`, `
        <p>Na základě oznámení o nezákonném obsahu jsme posoudili váš inzerát „${esc(l.title)}“.</p>
        <p><b>Důvod:</b> ${esc(dto.reason)}</p>
        <p><b>Rozsah opatření:</b> inzerát není veřejně dostupný. Rozhodl člověk z týmu moderace na základě oznámení třetí osoby (čl. 16 DSA).</p>
        <p>Pokud s rozhodnutím nesouhlasíte, můžete do 6 měsíců <a href="${config.webOrigin}/namitka?inzerat=${l.id}">podat námitku</a>. Máte také právo obrátit se na certifikovaný orgán mimosoudního řešení sporů nebo na soud.</p>`));
      await this.prisma.auditLog.create({ data: { actorId: u.id, action: `listing.${action === 'delete' ? 'delete' : 'reject'}`, targetType: 'listing', targetId: l.id, meta: { notice: n.ref, reason: dto.reason } } });
    }
    const done = await this.prisma.illegalContentNotice.update({ where: { id }, data: { status: dto.status, action, decisionReason: dto.reason, decidedById: u.id, decidedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: `notice.${dto.status.toLowerCase()}`, targetType: 'notice', targetId: id, meta: { ref: n.ref, action } } });
    if (n.reporterEmail) {
      await this.mailer.send(n.reporterEmail, `Rozhodnutí o oznámení ${n.ref}`, mail('Vaše oznámení jsme vyřídili', `
        <p>Oznámení č. <b>${n.ref}</b> týkající se ${esc(n.targetUrl)}: <b>${STATUS_TEXT[done.status]}</b>.</p>
        <p><b>Odůvodnění:</b> ${esc(dto.reason)}</p>
        <p>Rozhodnutí učinil člověk z týmu moderace. Pokud s ním nesouhlasíte, odpovězte prosím na tento e-mail nebo se obraťte na certifikovaný orgán mimosoudního řešení sporů či na soud.</p>`));
    }
    return { ok: true, status: done.status };
  }

  @Roles('MODERATOR')
  @Get('appeals')
  async appeals(@Query('status') status = 'OPEN') {
    const st = ['OPEN', 'UPHELD', 'REJECTED'].includes(status) ? (status as 'OPEN') : undefined;
    const rows = await this.prisma.moderationAppeal.findMany({ where: st ? { status: st } : {}, orderBy: { createdAt: st === 'OPEN' ? 'asc' : 'desc' }, take: 200 });
    const [ls, us] = await Promise.all([
      this.prisma.listing.findMany({ where: { id: { in: rows.map((r) => r.listingId) } }, select: { id: true, slug: true, title: true, status: true, rejectReason: true } }),
      this.prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true } }),
    ]);
    return rows.map((r) => ({ ...r, listing: ls.find((l) => l.id === r.listingId) ?? null, user: us.find((x) => x.id === r.userId) ?? null }));
  }

  @Roles('MODERATOR')
  @Post('appeals/:id/decide')
  async decideAppeal(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(DecideAppealDto)) dto: z.infer<typeof DecideAppealDto>) {
    const a = await this.prisma.moderationAppeal.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    if (a.status !== 'OPEN') throw new BadRequestException('Námitka už byla vyřízena.');
    const l = await this.prisma.listing.findUnique({ where: { id: a.listingId } });
    if (dto.status === 'UPHELD' && l && ['REJECTED', 'DELETED'].includes(l.status)) {
      await this.prisma.listing.update({ where: { id: l.id }, data: { status: 'ACTIVE', rejectReason: null, publishedAt: l.publishedAt ?? new Date() } });
      await this.search.index(l.id);
    }
    await this.prisma.moderationAppeal.update({ where: { id }, data: { status: dto.status, decisionReason: dto.reason, decidedById: u.id, decidedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: `appeal.${dto.status.toLowerCase()}`, targetType: 'appeal', targetId: id, meta: { ref: a.ref, listingId: a.listingId } } });
    const title = dto.status === 'UPHELD' ? 'Námitce jsme vyhověli – inzerát je opět zveřejněn' : 'Námitku jsme zamítli';
    await this.prisma.notification.create({ data: { userId: a.userId, type: 'moderation', title, body: dto.reason, link: '/muj-ucet/inzeraty' } });
    const owner = await this.prisma.user.findUnique({ where: { id: a.userId }, select: { email: true } });
    if (owner) await this.mailer.send(owner.email, `Rozhodnutí o námitce ${a.ref}`, mail(title, `<p>Inzerát: „${esc(l?.title ?? a.listingId)}“</p><p><b>Odůvodnění:</b> ${esc(dto.reason)}</p>${dto.status === 'REJECTED' ? '<p>Máte právo obrátit se na certifikovaný orgán mimosoudního řešení sporů nebo na soud.</p>' : ''}`));
    return { ok: true };
  }
}
