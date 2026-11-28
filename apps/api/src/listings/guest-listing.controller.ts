import { BadRequestException, Body, ConflictException, Controller, HttpException, HttpStatus, Logger, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { ClientInfo, clientInfo } from '../auth/audit';
import { termsOutdated } from '../users/terms';
import { applyContactPhone, ContactPhoneFields } from '../users/phone-contact';
import { AuthService } from '../auth/auth.service';
import { AuthUser, SESSION_COOKIE } from '../common/auth.guard';
import { verifyCaptcha } from '../common/captcha';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ZodPipe } from '../common/zod';
import {
  GUEST_COOKIE, GUEST_MAX_MAILS_PER_EMAIL_HOUR, type PendingListing, GUEST_MAX_PER_IP_HOUR, guestAccountDecision, guestName, guestOwner, validGuestToken,
} from './guest';
import { ListingDto, ListingsService } from './listings.service';

/** Vlastník fotek nahraných v tomto prohlížeči bez přihlášení (null = žádné). */
export function guestOwnerOf(req: Request): string | null {
  const t = req.cookies?.[GUEST_COOKIE] as unknown;
  return validGuestToken(t) ? guestOwner(t) : null;
}

/** Inzerát bez registrace: stejná pravidla jako běžné zveřejnění + kontaktní e-mail, jméno, souhlas a CAPTCHA. */
export const GuestListingDto = ListingDto.extend({
  email: z.email('Zadejte platný e-mail.').max(200),
  name: z.string().trim().max(60).optional(),
  terms: z.literal(true, { error: 'Je potřeba souhlasit s podmínkami a pravidly inzerování.' }),
  captcha: z.string().max(4096).optional(),
  /** E-mail už má účet a uživatel si místo přihlášení nechá poslat odkaz, který inzerát zveřejní v jeho účtu. */
  existingAccount: z.literal('link').optional(),
  ...ContactPhoneFields,
});
type GuestListingInput = z.infer<typeof GuestListingDto>;

export const ACCOUNT_EXISTS_MESSAGE = 'S tímto e-mailem už u nás máte účet. Inzerát vám zůstane – přihlaste se heslem, nebo si nechte poslat odkaz na e-mail.';

@Controller('listings/guest')
export class GuestListingController {
  private log = new Logger('GuestListing');
  constructor(private prisma: PrismaService, private redis: RedisService, private auth: AuthService, private listings: ListingsService) {}

  /**
   * Odeslání inzerátu bez přihlášení. Z e-mailu založí účet (bez hesla), inzerát uloží jako koncept
   * a pošle odkaz, který e-mail ověří, uživatele přihlásí a inzerát zveřejní.
   * Existující účet se nepoužije – uživatel se musí přihlásit (409, code ACCOUNT_EXISTS).
   */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  async create(@Body(new ZodPipe(GuestListingDto)) dto: GuestListingInput, @Req() req: Request) {
    await verifyCaptcha(dto.captcha, req.ip);
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    const decision = guestAccountDecision(existing);
    if (decision === 'login' && dto.existingAccount !== 'link') throw new ConflictException({ message: ACCOUNT_EXISTS_MESSAGE, code: 'ACCOUNT_EXISTS', field: 'email' });
    if (decision === 'login' && existing?.status === 'BLOCKED') throw new BadRequestException('Účet s tímto e-mailem je zablokován. Kontaktujte podporu.');
    if (existing && (await this.auth.recentVerificationMails(existing.id)) >= GUEST_MAX_MAILS_PER_EMAIL_HOUR) {
      throw new HttpException('Na tento e-mail jsme už poslali několik potvrzovacích odkazů. Zkontrolujte poštu (i složku Spam), nebo to zkuste za hodinu.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if ((await this.redis.incr(`guestlisting:${req.ip}`, 3600)) > GUEST_MAX_PER_IP_HOUR) {
      throw new HttpException('Z tohoto připojení bylo bez přihlášení vloženo už hodně inzerátů. Zkuste to za hodinu, nebo se zaregistrujte.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const { email: _e, name: _n, terms: _t, captcha: _c, existingAccount: _x, phone, hidePhone, ...listing } = dto;
    const showPhone = !!phone && !hidePhone;
    await this.listings.precheck({ ...listing, publish: true });

    // Existující účet: do účtu nic nezapíšeme, dokud majitel e-mailu neklikne na odkaz
    if (decision === 'login' && existing) {
      const dev = await this.auth.sendExistingAccountListingLink(existing, { listing: { ...listing, publish: true }, guestOwner: guestOwnerOf(req), ...(phone ? { contact: { phone, showPhone } } : {}) }, listing.title);
      return { ok: true, email, existingAccount: true, ...dev };
    }

    const client = clientInfo(req);
    const name = guestName(dto.name, email);
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { name } })
      : await this.auth.createGuestAccount(email, name, client);
    const authUser: AuthUser = { id: user.id, role: user.role, name: user.name, email: user.email, emailVerified: false, phoneVerified: false };
    const owner = guestOwnerOf(req);
    let created: { id: string; status: string };
    try {
      // Telefon u nového účtu: zobrazí se, až bude inzerát po potvrzení e-mailu aktivní
      if (phone) await applyContactPhone(this.prisma, user.id, phone, showPhone);
      await this.listings.claimGuestImages(owner, user.id, listing.imageIds);
      created = await this.listings.create(authUser, { ...listing, publish: false }, { strict: true });
    } catch (e) {
      // Inzerát neprošel (např. neplatná kategorie, limit) → vrátíme fotky prohlížeči a nový prázdný účet nenecháme ležet
      if (owner && listing.imageIds.length) await this.prisma.listingImage.updateMany({ where: { id: { in: listing.imageIds }, ownerId: user.id, listingId: null }, data: { ownerId: owner } });
      if (!existing) {
        await this.prisma.$transaction([this.prisma.auditLog.deleteMany({ where: { actorId: user.id } }), this.prisma.user.delete({ where: { id: user.id } })])
          .catch((err) => this.log.warn(`Účet ${user.id} se nepodařilo smazat: ${(err as Error).message}`));
      }
      throw e;
    }
    const dev = await this.auth.sendGuestListingConfirmation(user, created.id, listing.title, !existing);
    return { ok: true, email, listingId: created.id, ...dev };
  }

  /**
   * Potvrzení z e-mailu (POST tlačítkem na webu, aby inzerát nezveřejnila automatická kontrola odkazů v poště).
   * Ověří e-mail, přihlásí a zveřejní inzerát. Když zveřejnění neprojde (limit, změněná kategorie…),
   * e-mail i přihlášení platí a inzerát zůstane v konceptech s vysvětlením.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('confirm')
  async confirm(@Body(new ZodPipe(z.object({ token: z.string().min(10).max(200) }))) dto: { token: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const client = clientInfo(req);
    const { user, listingId, pending } = await this.auth.confirmGuestListing(dto.token, client);
    const s = await this.auth.loginSession(user, client, 'email_link');
    res.cookie(SESSION_COOKIE, s.token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, expires: s.expiresAt, path: '/' });
    const authUser: AuthUser = { id: user.id, role: user.role, name: user.name, email: user.email, emailVerified: true, phoneVerified: !!user.phoneVerifiedAt };
    if (pending) return this.publishPending(pending, user, authUser, client);
    if (!listingId) throw new BadRequestException('Kód je neplatný nebo vypršel.');
    try {
      const r = await this.listings.publishDraft(listingId, authUser);
      return { ok: true, listing: { id: r.id, slug: r.slug, status: r.status }, hasPassword: !!user.passwordHash };
    } catch (e) {
      const msg = e instanceof HttpException ? messageOf(e) : 'Inzerát se nepodařilo zveřejnit.';
      if (!(e instanceof HttpException)) this.log.error((e as Error).stack);
      return { ok: true, listing: { id: listingId, slug: null, status: 'DRAFT' }, publishError: msg, hasPassword: !!user.passwordHash };
    }
  }

  /**
   * Inzerát pro existující účet po kliknutí majitele: uloží a zveřejní ho stejně jako při přihlášení.
   * Když zveřejnění neprojde (limit, omezený účet…), uloží ho aspoň jako koncept, aby se neztratil.
   */
  private async publishPending(pending: PendingListing, user: User, authUser: AuthUser, client: ClientInfo) {
    const parsed = ListingDto.safeParse({ ...pending.listing, publish: true });
    if (!parsed.success) return { ok: true, listing: null, publishError: 'Inzerát se nepodařilo načíst. Vložte ho prosím znovu.', hasPassword: !!user.passwordHash };
    const dto = parsed.data;
    // Souhlas s podmínkami dal ve formuláři a potvrdil ho kliknutím v e-mailu (text e-mailu to uvádí)
    if (termsOutdated(user.termsVersion, config.termsVersion)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { termsAcceptedAt: new Date(), termsVersion: config.termsVersion } });
      await this.auth.audit(user.id, 'account.terms_accept', client, { termsVersion: config.termsVersion, via: 'listing_link' });
    }
    await this.listings.claimGuestImages(pending.guestOwner, user.id, dto.imageIds);
    // Číslo, které už účet má, odkaz nepřepíše (o změně čísla rozhoduje majitel v nastavení)
    if (pending.contact) await applyContactPhone(this.prisma, user.id, pending.contact.phone, pending.contact.showPhone, true).catch(() => false);
    try {
      const r = await this.listings.create(authUser, dto);
      return { ok: true, listing: { id: r.id, slug: r.slug, status: r.status }, hasPassword: !!user.passwordHash };
    } catch (e) {
      const msg = e instanceof HttpException ? messageOf(e) : 'Inzerát se nepodařilo zveřejnit.';
      if (!(e instanceof HttpException)) this.log.error((e as Error).stack);
      const draft = await this.listings.create(authUser, { ...dto, publish: false }).catch(() => null);
      return { ok: true, listing: draft ? { id: draft.id, slug: null, status: 'DRAFT' } : null, publishError: msg, hasPassword: !!user.passwordHash };
    }
  }
}

function messageOf(e: HttpException): string {
  const r = e.getResponse();
  if (typeof r === 'string') return r;
  const m = (r as { message?: unknown }).message;
  return Array.isArray(m) ? String(m[0]) : typeof m === 'string' ? m : e.message;
}
