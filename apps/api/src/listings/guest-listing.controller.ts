import { Body, ConflictException, Controller, HttpException, HttpStatus, Logger, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { clientInfo } from '../auth/audit';
import { AuthService } from '../auth/auth.service';
import { AuthUser, SESSION_COOKIE } from '../common/auth.guard';
import { verifyCaptcha } from '../common/captcha';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ZodPipe } from '../common/zod';
import {
  GUEST_COOKIE, GUEST_MAX_MAILS_PER_EMAIL_HOUR, GUEST_MAX_PER_IP_HOUR, guestAccountDecision, guestName, guestOwner, validGuestToken,
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
});
type GuestListingInput = z.infer<typeof GuestListingDto>;

export const ACCOUNT_EXISTS_MESSAGE = 'S tímto e-mailem už u nás máte účet. Přihlaste se a inzerát dokončíte – rozepsaný inzerát i fotky vám zůstanou.';

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
    if (decision === 'login') throw new ConflictException({ message: ACCOUNT_EXISTS_MESSAGE, code: 'ACCOUNT_EXISTS', field: 'email' });
    if (existing && (await this.auth.recentVerificationMails(existing.id)) >= GUEST_MAX_MAILS_PER_EMAIL_HOUR) {
      throw new HttpException('Na tento e-mail jsme už poslali několik potvrzovacích odkazů. Zkontrolujte poštu (i složku Spam), nebo to zkuste za hodinu.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if ((await this.redis.incr(`guestlisting:${req.ip}`, 3600)) > GUEST_MAX_PER_IP_HOUR) {
      throw new HttpException('Z tohoto připojení bylo bez přihlášení vloženo už hodně inzerátů. Zkuste to za hodinu, nebo se zaregistrujte.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const { email: _e, name: _n, terms: _t, captcha: _c, ...listing } = dto;
    await this.listings.precheck({ ...listing, publish: true });

    const client = clientInfo(req);
    const name = guestName(dto.name, email);
    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { name } })
      : await this.auth.createGuestAccount(email, name, client);
    const authUser: AuthUser = { id: user.id, role: user.role, name: user.name, email: user.email, emailVerified: false, phoneVerified: false };
    const owner = guestOwnerOf(req);
    let created: { id: string; status: string };
    try {
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
    const { user, listingId } = await this.auth.confirmGuestListing(dto.token, client);
    const s = await this.auth.loginSession(user, client, 'email_link');
    res.cookie(SESSION_COOKIE, s.token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, expires: s.expiresAt, path: '/' });
    const authUser: AuthUser = { id: user.id, role: user.role, name: user.name, email: user.email, emailVerified: true, phoneVerified: !!user.phoneVerifiedAt };
    try {
      const r = await this.listings.publishDraft(listingId, authUser);
      return { ok: true, listing: { id: r.id, slug: r.slug, status: r.status }, hasPassword: !!user.passwordHash };
    } catch (e) {
      const msg = e instanceof HttpException ? messageOf(e) : 'Inzerát se nepodařilo zveřejnit.';
      if (!(e instanceof HttpException)) this.log.error((e as Error).stack);
      return { ok: true, listing: { id: listingId, slug: null, status: 'DRAFT' }, publishError: msg, hasPassword: !!user.passwordHash };
    }
  }
}

function messageOf(e: HttpException): string {
  const r = e.getResponse();
  if (typeof r === 'string') return r;
  const m = (r as { message?: unknown }).message;
  return Array.isArray(m) ? String(m[0]) : typeof m === 'string' ? m : e.message;
}
