import { BadRequestException, Body, Controller, ForbiddenException, Get, Logger, NotFoundException, Param, Post, Put, Query, ServiceUnavailableException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { Auth, AuthUser, CurrentUser } from '../common/auth.guard';
import { Can } from '../common/permissions';
import { MailerService } from '../common/mailer.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ZodPipe } from '../common/zod';
import { config } from '../common/config';
import { StorageService } from '../media/storage.service';
import { assessMessageSafety, cleanPreview, escapeHtml, foreignPhones } from './link-check';
import { directKey, isOwnMediaUrl, messageEmail, ownHosts, photosEnabled, safeName } from './messages.util';
import { TrustService } from '../admin/trust.service';

export { escapeHtml };

const MsgDto = z.object({ body: z.string().trim().max(4000).default(''), attachmentId: z.string().trim().max(40).optional() })
  .refine((d) => d.body.length > 0 || d.attachmentId, 'Zpráva je prázdná.');
type Msg = z.infer<typeof MsgDto>;
const ReportDto = z.object({ reason: z.string().trim().min(2).max(80), note: z.string().trim().max(1000).optional() });
type ReportIn = z.infer<typeof ReportDto>;
const PrefDto = z.object({ emailOnMessage: z.boolean() });

const MAX_IMAGE = 8 * 1024 * 1024; // na Vercelu je strop požadavku 4,5 MB, klient fotku předem zmenší
const LISTING_SELECT = { id: true, title: true, slug: true, price: true, priceNegotiable: true, status: true, userId: true, images: { take: 1, orderBy: { position: 'asc' as const } } };
// Kontaktní údaje (e-mail, telefon) se do konverzace nikdy automaticky neposílají
const PERSON_SELECT = { id: true, name: true, avatarUrl: true, phoneVerifiedAt: true };

type ListingRow = { id: string; title: string; slug: string; price: number | null; priceNegotiable: boolean; status: string; images: { thumbUrl: string }[] } | null;
const listingOut = (l: ListingRow) => (l ? { id: l.id, title: l.title, slug: l.slug, price: l.price, priceNegotiable: l.priceNegotiable, status: l.status, image: l.images[0]?.thumbUrl ?? null } : null);

@Auth()
@Controller()
export class MessagesController {
  private log = new Logger('Messages');
  constructor(private prisma: PrismaService, private redis: RedisService, private mail: MailerService, private storage: StorageService, private trust: TrustService) {}

  private async blocked(a: string, b: string) {
    return !!(await this.prisma.block.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] } }));
  }

  private async participantConv(id: string, u: AuthUser) {
    const c = await this.prisma.conversation.findUnique({ where: { id }, include: { listing: { select: { title: true } } } });
    if (!c || (c.buyerId !== u.id && c.sellerId !== u.id)) throw new NotFoundException('Konverzace neexistuje.');
    return c;
  }

  private mySide(c: { buyerId: string }, u: AuthUser) { return c.buyerId === u.id ? 'buyerArchivedAt' as const : 'sellerArchivedAt' as const; }

  @Get('conversations')
  async list(@CurrentUser() u: AuthUser, @Query('archived') archived?: string) {
    const arch = archived === '1';
    const convs = await this.prisma.conversation.findMany({
      where: arch
        ? { OR: [{ buyerId: u.id, buyerArchivedAt: { not: null } }, { sellerId: u.id, sellerArchivedAt: { not: null } }] }
        : { OR: [{ buyerId: u.id, buyerArchivedAt: null }, { sellerId: u.id, sellerArchivedAt: null }] },
      orderBy: { lastMessageAt: 'desc' }, take: 100,
      include: {
        listing: { select: LISTING_SELECT },
        buyer: { select: { id: true, name: true, avatarUrl: true } }, seller: { select: { id: true, name: true, avatarUrl: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, imageUrl: true, createdAt: true, senderId: true } },
        _count: { select: { messages: { where: { readAt: null, senderId: { not: u.id } } } } },
      },
    });
    return convs.map((c) => ({
      id: c.id, listing: listingOut(c.listing),
      other: c.buyerId === u.id ? c.seller : c.buyer, role: c.buyerId === u.id ? 'buyer' : 'seller',
      lastMessage: c.messages[0] ?? null, unread: c._count.messages, lastMessageAt: c.lastMessageAt, archived: arch,
    }));
  }

  @Get('conversations/:id')
  async get(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const c = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        listing: { select: LISTING_SELECT },
        buyer: { select: PERSON_SELECT }, seller: { select: PERSON_SELECT },
        // posledních 500 zpráv (ne prvních 500), aby se v dlouhé konverzaci zobrazily ty nové
        messages: { orderBy: { createdAt: 'desc' }, take: 500 },
        reviews: { where: { authorId: u.id } },
      },
    });
    if (!c || (c.buyerId !== u.id && c.sellerId !== u.id)) throw new NotFoundException('Konverzace neexistuje.');
    c.messages.reverse();
    const now = new Date();
    await Promise.all([
      this.prisma.message.updateMany({ where: { conversationId: id, senderId: { not: u.id }, readAt: null }, data: { readAt: now } }),
      this.prisma.notification.updateMany({ where: { userId: u.id, type: 'message', link: `/zpravy/${id}`, readAt: null }, data: { readAt: now } }),
    ]);
    const otherId = c.buyerId === u.id ? c.sellerId : c.buyerId;
    const iBlocked = !!(await this.prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: u.id, blockedId: otherId } } }));
    const replies = { mine: c.messages.some((m) => m.senderId === u.id), theirs: c.messages.some((m) => m.senderId === otherId) };
    const hosts = ownHosts();
    return {
      id: c.id, listing: listingOut(c.listing),
      other: c.buyerId === u.id ? c.seller : c.buyer, role: c.buyerId === u.id ? 'buyer' : 'seller',
      messages: c.messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, imageUrl: m.imageUrl, createdAt: m.createdAt, readAt: m.readAt, warning: m.senderId !== u.id ? assessMessageSafety(m.body, hosts) : null })),
      iBlocked, blocked: iBlocked || (await this.blocked(u.id, otherId)),
      archived: !!c[this.mySide(c, u)], photos: photosEnabled(),
      // Hodnotit lze jen prodejce inzerátu a jen po skutečné oboustranné komunikaci
      canReview: !!c.listingId && c.buyerId === u.id && replies.mine && replies.theirs && c.reviews.length === 0,
      myReview: c.reviews[0] ?? null,
    };
  }

  private async newConvAllowed(u: AuthUser) {
    if ((await this.redis.incr(`newconv:${u.id}`, 3600)) > 30) throw new BadRequestException('Příliš mnoho nových konverzací. Zkuste to později.');
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('listings/:id/message')
  async start(@Param('id') listingId: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(MsgDto)) dto: Msg) {
    if (dto.attachmentId) throw new BadRequestException('Fotku pošlete až v otevřené konverzaci.');
    const l = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!l || !['ACTIVE', 'RESERVED'].includes(l.status)) throw new NotFoundException('Inzerát není aktivní.');
    if (l.userId === u.id) throw new BadRequestException('Nemůžete psát sami sobě.');
    await this.trust.assertNotRestricted(u.id); // WP6: omezený účet nesmí psát
    if (await this.blocked(u.id, l.userId)) throw new ForbiddenException('Komunikace s tímto uživatelem není možná.');
    await this.newConvAllowed(u);
    const conv = await this.prisma.conversation.upsert({ where: { listingId_buyerId: { listingId, buyerId: u.id } }, create: { listingId, buyerId: u.id, sellerId: l.userId }, update: {} });
    await this.send(conv.id, u, dto);
    return { conversationId: conv.id };
  }

  /** Zpráva z profilu uživatele – bez vazby na inzerát. Na dvojici uživatelů je jedna taková konverzace. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('users/:id/message')
  async startDirect(@Param('id') userId: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(MsgDto)) dto: Msg) {
    if (dto.attachmentId) throw new BadRequestException('Fotku pošlete až v otevřené konverzaci.');
    if (userId === u.id) throw new BadRequestException('Nemůžete psát sami sobě.');
    const target = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
    if (!target || target.status !== 'ACTIVE') throw new NotFoundException('Uživatel neexistuje.');
    if (await this.blocked(u.id, userId)) throw new ForbiddenException('Komunikace s tímto uživatelem není možná.');
    const key = directKey(u.id, userId);
    let conv = await this.prisma.conversation.findUnique({ where: { directKey: key } });
    if (!conv) {
      await this.newConvAllowed(u);
      try {
        conv = await this.prisma.conversation.create({ data: { buyerId: u.id, sellerId: userId, directKey: key } });
      } catch (e) {
        // souběh dvou požadavků – konverzace už mezitím vznikla
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') conv = await this.prisma.conversation.findUniqueOrThrow({ where: { directKey: key } });
        else throw e;
      }
    }
    await this.send(conv.id, u, dto);
    return { conversationId: conv.id };
  }

  /** Fotka do konverzace: jen účastník, jen obrázek, EXIF (GPS) se odstraní. Vrací id přílohy pro odeslání zprávy. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('conversations/:id/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE, files: 1 } }))
  async uploadImage(@Param('id') id: string, @CurrentUser() u: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    const c = await this.participantConv(id, u);
    if (await this.blocked(c.buyerId, c.sellerId)) throw new ForbiddenException('Komunikace s tímto uživatelem byla zablokována.');
    if (!photosEnabled()) throw new ServiceUnavailableException('Posílání fotek zatím není zapnuté.');
    if (!file) throw new BadRequestException('Chybí fotka.');
    if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.mimetype)) throw new BadRequestException('Podporujeme fotky JPG, PNG, WebP a HEIC.');
    // Nahrané, ale neodeslané fotky jsou veřejné URL – ať úložiště nejde zneužít jako hosting obrázků
    const unsent = await this.prisma.messageAttachment.count({ where: { ownerId: u.id, messageId: null, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
    if (unsent >= 10) throw new BadRequestException('Máte příliš mnoho neodeslaných fotek. Zkuste to později.');
    if ((await this.redis.incr(`msgimg:${u.id}`, 86_400)) > 200) throw new BadRequestException('Dnes už jste poslali příliš mnoho fotek.');
    let out: { data: Buffer; info: sharp.OutputInfo };
    try {
      out = await sharp(file.buffer, { failOn: 'error' }).rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
    } catch { throw new BadRequestException('Soubor není platný obrázek.'); }
    const url = await this.storage.put(`messages/${id}/${randomBytes(12).toString('hex')}.webp`, out.data, 'image/webp');
    const a = await this.prisma.messageAttachment.create({ data: { ownerId: u.id, conversationId: id, url, width: out.info.width, height: out.info.height } });
    return { id: a.id, url: a.url, width: a.width, height: a.height };
  }

  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post('conversations/:id/messages')
  async send(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(MsgDto)) dto: Msg) {
    const c = await this.participantConv(id, u);
    await this.trust.assertNotRestricted(u.id); // WP6: omezený účet nesmí psát
    const otherId = c.buyerId === u.id ? c.sellerId : c.buyerId;
    if (await this.blocked(u.id, otherId)) throw new ForbiddenException('Komunikace s tímto uživatelem byla zablokována.');

    // Fotka jen jako příloha nahraná do této konverzace tímto uživatelem – žádné cizí URL
    let imageUrl: string | null = null;
    if (dto.attachmentId) {
      const a = await this.prisma.messageAttachment.findFirst({ where: { id: dto.attachmentId, ownerId: u.id, conversationId: id, messageId: null } });
      if (!a || !isOwnMediaUrl(a.url)) throw new BadRequestException('Fotku se nepodařilo připojit. Nahrajte ji prosím znovu.');
      imageUrl = a.url;
    }
    const msg = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { conversationId: id, senderId: u.id, body: dto.body, imageUrl } });
      if (dto.attachmentId) {
        const r = await tx.messageAttachment.updateMany({ where: { id: dto.attachmentId, messageId: null }, data: { messageId: m.id } });
        if (r.count !== 1) throw new BadRequestException('Fotka už byla odeslána.');
      }
      // Nová zpráva vrátí konverzaci z archivu oběma účastníkům
      await tx.conversation.update({ where: { id }, data: { lastMessageAt: m.createdAt, buyerArchivedAt: null, sellerArchivedAt: null } });
      return m;
    });
    if (dto.body) await this.trust.afterMessage(u.id, dto.body).catch(() => false); // WP6: podezřelé zprávy → automatické omezení
    await this.notify(c, u, otherId, dto.body, !!imageUrl).catch((e) => this.log.warn(`Notifikace se nepodařila: ${(e as Error).message}`));
    return { id: msg.id, senderId: msg.senderId, body: msg.body, imageUrl: msg.imageUrl, createdAt: msg.createdAt, readAt: msg.readAt };
  }

  /** In-app notifikace (jedna nepřečtená na konverzaci) a e-mail nejvýše 1× za 30 min. Uživatelský text je escapovaný. */
  private async notify(c: { id: string; listing: { title: string } | null }, u: AuthUser, otherId: string, body: string, hasImage: boolean) {
    const name = safeName(u.name);
    const risky = !!assessMessageSafety(body, ownHosts()) || foreignPhones(body).length > 0;
    const preview = body ? (risky ? 'Zpráva obsahuje odkaz nebo kontakt – zobrazte ji přímo na Dejinzerat.cz.' : cleanPreview(body)) : '📷 Fotografie';
    const link = `/zpravy/${c.id}`;
    const title = `Nová zpráva od ${name}`;
    const existing = await this.prisma.notification.findFirst({ where: { userId: otherId, type: 'message', link, readAt: null }, select: { id: true } });
    if (existing) await this.prisma.notification.update({ where: { id: existing.id }, data: { title, body: preview, createdAt: new Date() } });
    else await this.prisma.notification.create({ data: { userId: otherId, type: 'message', title, body: preview, link } });

    const [other, pref] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: otherId }, select: { email: true, status: true } }),
      this.prisma.messagePreference.findUnique({ where: { userId: otherId } }),
    ]);
    if (!other || other.status !== 'ACTIVE' || pref?.emailOnMessage === false) return;
    if (!(await this.redis.lock(`msgmail:${c.id}:${otherId}`, 1800))) return;
    const { subject, html } = messageEmail({ name, listingTitle: c.listing?.title ?? null, body, risky, hasImage, url: `${config.webOrigin}${link}`, settingsUrl: `${config.webOrigin}/zpravy` });
    await this.mail.send(other.email, subject, html);
  }

  @Post('conversations/:id/archive')
  async archive(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const c = await this.participantConv(id, u);
    await this.prisma.conversation.update({ where: { id }, data: { [this.mySide(c, u)]: new Date() } });
    await this.prisma.message.updateMany({ where: { conversationId: id, senderId: { not: u.id }, readAt: null }, data: { readAt: new Date() } });
    await this.prisma.notification.updateMany({ where: { userId: u.id, type: 'message', link: `/zpravy/${id}`, readAt: null }, data: { readAt: new Date() } });
    return { ok: true, archived: true };
  }

  @Post('conversations/:id/unarchive')
  async unarchive(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const c = await this.participantConv(id, u);
    await this.prisma.conversation.update({ where: { id }, data: { [this.mySide(c, u)]: null } });
    return { ok: true, archived: false };
  }

  private async createReport(u: AuthUser, targetType: 'CONVERSATION' | 'MESSAGE', targetId: string, conversationId: string, dto: ReportIn, ownerId?: string) {
    const dup = await this.prisma.report.findFirst({ where: { reporterId: u.id, targetType, targetId, status: 'OPEN' }, select: { id: true } });
    if (!dup) {
      await this.prisma.report.create({ data: { reporterId: u.id, targetType, targetId, conversationId, reason: dto.reason, note: dto.note || undefined } });
      // WP6: nahlášení od více různých lidí vede k automatickému omezení autora zpráv
      if (ownerId) await this.trust.afterReport(ownerId).catch(() => false);
    }
    return { ok: true };
  }

  /** Nahlášení celé konverzace – moderátor ji pak uvidí jen ke čtení. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('conversations/:id/report')
  async reportConversation(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(ReportDto)) dto: ReportIn) {
    await this.participantConv(id, u);
    return this.createReport(u, 'CONVERSATION', id, id, dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('messages/:id/report')
  async reportMessage(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(ReportDto)) dto: ReportIn) {
    const m = await this.prisma.message.findUnique({ where: { id }, include: { conversation: { select: { id: true, buyerId: true, sellerId: true } } } });
    if (!m || (m.conversation.buyerId !== u.id && m.conversation.sellerId !== u.id)) throw new NotFoundException('Zpráva neexistuje.');
    if (m.senderId === u.id) throw new BadRequestException('Vlastní zprávu nahlásit nelze.');
    return this.createReport(u, 'MESSAGE', id, m.conversation.id, dto, m.senderId);
  }

  @Get('me/message-settings')
  async prefs(@CurrentUser() u: AuthUser) {
    const p = await this.prisma.messagePreference.findUnique({ where: { userId: u.id } });
    return { emailOnMessage: p?.emailOnMessage ?? true };
  }

  @Put('me/message-settings')
  async savePrefs(@CurrentUser() u: AuthUser, @Body(new ZodPipe(PrefDto)) dto: z.infer<typeof PrefDto>) {
    const p = await this.prisma.messagePreference.upsert({ where: { userId: u.id }, create: { userId: u.id, ...dto }, update: dto });
    return { emailOnMessage: p.emailOnMessage };
  }

  /** Moderátor: nahlášená konverzace jen ke čtení. Nenahlášené konverzace zůstávají soukromé. */
  @Can('reports.read')
  @Get('admin/conversations/:id')
  async adminView(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const reports = await this.prisma.report.findMany({ where: { conversationId: id }, orderBy: { createdAt: 'desc' }, include: { reporter: { select: { id: true, name: true } } } });
    if (!reports.length) throw new NotFoundException('Konverzace nebyla nahlášena.');
    const c = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        listing: { select: LISTING_SELECT },
        buyer: { select: { id: true, name: true, email: true, status: true, createdAt: true } }, seller: { select: { id: true, name: true, email: true, status: true, createdAt: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 500 },
      },
    });
    if (!c) throw new NotFoundException('Konverzace neexistuje.');
    c.messages.reverse();
    await this.prisma.auditLog.create({ data: { actorId: u.id, action: 'report.view_conversation', targetType: 'conversation', targetId: id } });
    const hosts = ownHosts();
    return {
      id: c.id, createdAt: c.createdAt, listing: listingOut(c.listing), buyer: c.buyer, seller: c.seller,
      messages: c.messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, imageUrl: m.imageUrl, createdAt: m.createdAt, warning: assessMessageSafety(m.body, hosts) })),
      reports: reports.map((r) => ({ id: r.id, targetType: r.targetType, targetId: r.targetId, reason: r.reason, note: r.note, status: r.status, createdAt: r.createdAt, reporter: r.reporter })),
    };
  }

  @Post('users/:id/block')
  async block(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    if (id === u.id) throw new BadRequestException();
    await this.prisma.block.upsert({ where: { blockerId_blockedId: { blockerId: u.id, blockedId: id } }, create: { blockerId: u.id, blockedId: id }, update: {} });
    return { ok: true };
  }

  @Post('users/:id/unblock')
  async unblock(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    await this.prisma.block.deleteMany({ where: { blockerId: u.id, blockedId: id } });
    return { ok: true };
  }

  @Post('conversations/:id/review')
  async review(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ rating: z.number().int().min(1).max(5), text: z.string().trim().max(1000).optional() }))) dto: { rating: number; text?: string }) {
    const c = await this.get(id, u);
    if (!c.canReview) throw new BadRequestException('Hodnotit můžete až po vzájemné komunikaci s prodejcem, a to jen jednou.');
    const conv = await this.prisma.conversation.findUniqueOrThrow({ where: { id } });
    await this.prisma.review.create({ data: { authorId: u.id, sellerId: conv.sellerId, conversationId: id, rating: dto.rating, text: dto.text } });
    await this.prisma.notification.create({ data: { userId: conv.sellerId, type: 'review', title: `${safeName(u.name)} vás ohodnotil(a) ${'★'.repeat(dto.rating)}`, link: `/uzivatel/${conv.sellerId}` } });
    return { ok: true };
  }
}
