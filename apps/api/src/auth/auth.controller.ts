import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { Auth, AuthUser, CurrentUser, SESSION_COOKIE } from '../common/auth.guard';
import { captchaEnabled, verifyCaptcha } from '../common/captcha';
import { config } from '../common/config';
import { SmsService } from '../common/mailer.service';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { StorageService } from '../media/storage.service';
import { unreadCounts } from '../users/unread';
import { clientInfo } from './audit';
import { AuthService, OAuthError } from './auth.service';
import { packOAuthState, safeBack, sameState, unpackOAuthState } from './oauth-state';

const password = z.string().min(8, 'Heslo musí mít alespoň 8 znaků.').max(200);
const email = z.email('Zadejte platný e-mail.').max(200);
const RegisterDto = z.object({ email, password, name: z.string().trim().min(2, 'Zadejte jméno.').max(60), captcha: z.string().max(4096).optional(), terms: z.literal(true, { error: 'Je potřeba souhlasit s podmínkami.' }) });
const LoginDto = z.object({ email, password: z.string().min(1, 'Zadejte heslo.').max(200) });
const ForgotDto = z.object({ email, captcha: z.string().max(4096).optional() });
const EmailChangeDto = z.object({ email, password: z.string().max(200).optional() });
const PhoneDto = z.object({ phone: z.string().regex(/^\+?(420|421)?\s?\d{3}\s?\d{3}\s?\d{3}$/, 'Zadejte platné české nebo slovenské číslo.') });
const CodeDto = z.object({ code: z.string().regex(/^\d{6}$/, 'Kód má 6 číslic.') });

const OAUTH_COOKIE = 'dej_oauth';
const APPLE_COOKIE = 'dej_oauth_apple';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService, private sms: SmsService, private storage: StorageService) {}

  private setCookie(res: Response, token: string, expires: Date) {
    res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, expires, path: '/' });
  }
  private clearSession(res: Response) {
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/' });
  }
  private token(req: Request): string | undefined { return req.cookies?.[SESSION_COOKIE]; }

  @Get('providers')
  providers() {
    const a = config.apple;
    return {
      google: !!(config.google.clientId && config.google.clientSecret), apple: !!(a.clientId && a.teamId && a.keyId && a.privateKey),
      // ve vývoji se kód z SMS zobrazí přímo v nastavení, v produkci je potřeba brána GoSMS
      sms: this.sms.enabled || process.env.NODE_ENV !== 'production',
      captchaSiteKey: captchaEnabled() ? config.turnstileSiteKey : null,
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body(new ZodPipe(RegisterDto)) dto: z.infer<typeof RegisterDto>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await verifyCaptcha(dto.captcha, req.ip);
    const client = clientInfo(req);
    const user = await this.auth.register(dto.email, dto.password, dto.name, client);
    const s = await this.auth.createSession(user.id, client);
    this.setCookie(res, s.token, s.expiresAt);
    return { ok: true };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body(new ZodPipe(LoginDto)) dto: z.infer<typeof LoginDto>, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const client = clientInfo(req);
    const user = await this.auth.login(dto.email, dto.password, client);
    const s = await this.auth.loginSession(user, client, 'password');
    this.setCookie(res, s.token, s.expiresAt);
    return { ok: true };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const t = this.token(req);
    if (t) await this.auth.revokeSession(t);
    this.clearSession(res);
    return { ok: true };
  }

  @Auth('optional')
  @Get('me')
  async me(@CurrentUser() u?: AuthUser) {
    if (!u) return { user: null };
    const user = await this.prisma.user.findUnique({
      where: { id: u.id },
      select: { id: true, email: true, name: true, role: true, phone: true, avatarUrl: true, city: true, region: true, bio: true, isBusiness: true, companyName: true, companyId: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true, passwordHash: true, googleId: true, appleId: true },
    });
    if (!user) return { user: null };
    const { messages: unreadMessages, notifications: unreadNotifications } = await unreadCounts(this.prisma, u.id);
    const { passwordHash, googleId, appleId, ...rest } = user;
    return { user: { ...rest, hasPassword: !!passwordHash, hasGoogle: !!googleId, hasApple: !!appleId, unreadMessages, unreadNotifications } };
  }

  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) { await this.auth.verifyEmail(token ?? ''); return { ok: true }; }

  @Auth()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('resend-verification')
  async resend(@CurrentUser() u: AuthUser) {
    await this.auth.sendEmailVerification(await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } }));
    return { ok: true };
  }

  /** Změna e-mailu: potvrzovací odkaz přijde na novou adresu. */
  @Auth()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/change')
  async emailChange(@CurrentUser() u: AuthUser, @Body(new ZodPipe(EmailChangeDto)) dto: z.infer<typeof EmailChangeDto>) {
    return this.auth.requestEmailChange(u.id, dto.email, dto.password);
  }

  /** Potvrzení nového e-mailu tlačítkem na webu (POST, aby odkaz nepotvrdily automatické kontroly odkazů v poště). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('email/confirm')
  async emailConfirm(@Body(new ZodPipe(z.object({ token: z.string().min(10).max(200) }))) dto: { token: string }, @Req() req: Request) {
    await this.auth.confirmEmailChange(dto.token, clientInfo(req)); return { ok: true };
  }

  @Auth()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('phone/send')
  phoneSend(@CurrentUser() u: AuthUser, @Body(new ZodPipe(PhoneDto)) dto: z.infer<typeof PhoneDto>) {
    let p = dto.phone.replace(/\s/g, '');
    if (!p.startsWith('+')) p = p.length === 9 ? `+420${p}` : `+${p}`;
    return this.auth.sendPhoneCode(u.id, p);
  }

  @Auth()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  @Post('phone/verify')
  async phoneVerify(@CurrentUser() u: AuthUser, @Body(new ZodPipe(CodeDto)) dto: z.infer<typeof CodeDto>, @Req() req: Request) {
    await this.auth.verifyPhone(u.id, dto.code, clientInfo(req)); return { ok: true };
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password/forgot')
  async forgot(@Body(new ZodPipe(ForgotDto)) dto: z.infer<typeof ForgotDto>, @Req() req: Request) {
    await verifyCaptcha(dto.captcha, req.ip);
    await this.auth.forgotPassword(dto.email); return { ok: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/reset')
  async reset(@Body(new ZodPipe(z.object({ token: z.string().min(10).max(200), password }))) dto: { token: string; password: string }, @Req() req: Request) {
    await this.auth.resetPassword(dto.token, dto.password, clientInfo(req)); return { ok: true };
  }

  @Auth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('password/change')
  async change(@CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ current: z.string().max(200).default(''), password }))) dto: { current: string; password: string }, @Req() req: Request) {
    const r = await this.auth.changePassword(u.id, dto.current, dto.password, this.token(req), clientInfo(req));
    return { ok: true, ...r };
  }

  /** Přihlášená zařízení (aktivní session) přihlášeného uživatele. */
  @Auth()
  @Get('sessions')
  sessions(@CurrentUser() u: AuthUser, @Req() req: Request) { return this.auth.listSessions(u.id, this.token(req)); }

  @Auth()
  @Post('sessions/revoke-all')
  async revokeAll(@CurrentUser() u: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const n = await this.auth.revokeAll(u.id);
    await this.auth.audit(u.id, 'auth.sessions_revoke_all', clientInfo(req), { revokedSessions: n });
    this.clearSession(res); return { ok: true };
  }

  @Auth()
  @Delete('sessions/:id')
  async revokeOne(@CurrentUser() u: AuthUser, @Param('id') id: string, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const current = await this.auth.revokeSessionById(u.id, id, this.token(req));
    await this.auth.audit(u.id, 'auth.session_revoke', clientInfo(req), { sessionId: id, current });
    if (current) this.clearSession(res);
    return { ok: true, current };
  }

  /** Profilová fotka: čtverec 400 × 400 px ve WebP, bez EXIF. */
  @Auth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 4 * 1024 * 1024 } }))
  async avatar(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() u: AuthUser) {
    if (!file) throw new BadRequestException('Vyberte obrázek.');
    if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.mimetype)) throw new BadRequestException('Podporujeme JPG, PNG, WebP a HEIC.');
    let buf: Buffer;
    try { buf = await sharp(file.buffer, { failOn: 'error' }).rotate().resize(400, 400, { fit: 'cover' }).webp({ quality: 80 }).toBuffer(); } catch { throw new BadRequestException('Soubor není platný obrázek.'); }
    const url = await this.storage.put(`avatars/${u.id}-${randomBytes(6).toString('hex')}.webp`, buf, 'image/webp');
    await this.prisma.user.update({ where: { id: u.id }, data: { avatarUrl: url } });
    await this.auth.flushUser(u.id);
    return { url };
  }

  @Auth()
  @Delete('avatar')
  async avatarDelete(@CurrentUser() u: AuthUser) {
    await this.prisma.user.update({ where: { id: u.id }, data: { avatarUrl: null } });
    await this.auth.flushUser(u.id);
    return { ok: true };
  }

  /** Chyba OAuth → zpět na přihlášení s hláškou (?chyba=oauth|blokovan|email) a zachovanou návratovou adresou. */
  private oauthFail(res: Response, e: unknown, back = '/') {
    const code = e instanceof OAuthError ? e.code : 'oauth';
    if (e) this.auth.logError(e);
    const q = new URLSearchParams({ chyba: code, ...(back !== '/' ? { zpet: back } : {}) });
    return res.redirect(`${config.webOrigin}/prihlaseni?${q}`);
  }

  @Get('google')
  google(@Query('zpet') zpet: string | undefined, @Res() res: Response) {
    const back = safeBack(zpet);
    if (!config.google.clientId || !config.google.clientSecret) return res.redirect(`${config.webOrigin}/prihlaseni?chyba=google`);
    const state = randomBytes(16).toString('hex');
    res.cookie(OAUTH_COOKIE, packOAuthState({ state, nonce: randomBytes(8).toString('hex'), back }), { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: 600_000, path: '/' });
    return res.redirect(this.auth.googleAuthUrl(state));
  }

  @Get('google/callback')
  async googleCb(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('error') error: string | undefined, @Req() req: Request, @Res() res: Response) {
    const saved = unpackOAuthState(req.cookies?.[OAUTH_COOKIE]);
    res.clearCookie(OAUTH_COOKIE, { path: '/' });
    const back = saved?.back ?? '/';
    try {
      if (error) throw new OAuthError('oauth', `Google: ${String(error).slice(0, 60)}`);
      if (typeof code !== 'string' || !code || !saved || !sameState(state, saved.state)) throw new OAuthError('oauth', 'Google: chybí code nebo nesouhlasí state.');
      const client = clientInfo(req);
      const user = await this.auth.googleCallback(code, client);
      const s = await this.auth.loginSession(user, client, 'google');
      this.setCookie(res, s.token, s.expiresAt);
      return res.redirect(`${config.webOrigin}${back}`);
    } catch (e) {
      return this.oauthFail(res, e, back);
    }
  }

  @Get('apple')
  apple(@Query('zpet') zpet: string | undefined, @Res() res: Response) {
    const a = config.apple;
    if (!(a.clientId && a.teamId && a.keyId && a.privateKey)) return res.redirect(`${config.webOrigin}/prihlaseni?chyba=apple`);
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    // Apple vrací odpověď jako POST z appleid.apple.com, proto musí cookie se stavem projít i mezi weby (SameSite=None).
    res.cookie(APPLE_COOKIE, packOAuthState({ state, nonce, back: safeBack(zpet) }), { httpOnly: true, sameSite: 'none', secure: true, maxAge: 600_000, path: '/' });
    return res.redirect(this.auth.appleAuthUrl(state, nonce));
  }

  @Post('apple/callback')
  async appleCb(@Body() body: { code?: unknown; state?: unknown; user?: unknown; error?: unknown } | undefined, @Req() req: Request, @Res() res: Response) {
    const saved = unpackOAuthState(req.cookies?.[APPLE_COOKIE]);
    res.clearCookie(APPLE_COOKIE, { path: '/', sameSite: 'none', secure: true });
    const back = saved?.back ?? '/';
    try {
      if (body?.error) throw new OAuthError('oauth', `Apple: ${String(body.error).slice(0, 60)}`);
      if (typeof body?.code !== 'string' || !body.code || !saved || !sameState(typeof body.state === 'string' ? body.state : '', saved.state)) {
        throw new OAuthError('oauth', 'Apple: chybí code nebo nesouhlasí state.');
      }
      const client = clientInfo(req);
      const user = await this.auth.appleCallback(body.code, typeof body.user === 'string' ? body.user : undefined, saved.nonce, client);
      const s = await this.auth.loginSession(user, client, 'apple');
      this.setCookie(res, s.token, s.expiresAt);
      // 303: prohlížeč po POSTu z Apple pokračuje GETem
      return res.redirect(303, `${config.webOrigin}${back}`);
    } catch (e) {
      const code = e instanceof OAuthError ? e.code : 'oauth';
      if (e) this.auth.logError(e);
      const q = new URLSearchParams({ chyba: code, ...(back !== '/' ? { zpet: back } : {}) });
      return res.redirect(303, `${config.webOrigin}/prihlaseni?${q}`);
    }
  }
}
