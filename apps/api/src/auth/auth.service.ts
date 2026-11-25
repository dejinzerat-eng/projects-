import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { TokenType, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt } from 'crypto';
import { hashToken } from '../common/auth.guard';
import { config } from '../common/config';
import { MailerService, SmsService } from '../common/mailer.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

const SESSION_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private mail: MailerService, private sms: SmsService, private redis: RedisService) {}

  async register(email: string, password: string, name: string) {
    email = email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new BadRequestException('Účet s tímto e-mailem už existuje.');
    const user = await this.prisma.user.create({ data: { email, name, passwordHash: await bcrypt.hash(password, 12) } });
    await this.sendEmailVerification(user);
    return user;
  }

  async login(email: string, password: string, ip: string) {
    const key = `login:${ip}:${email.toLowerCase()}`;
    if ((await this.redis.incr(key, 900)) > 10) throw new UnauthorizedException('Příliš mnoho pokusů. Zkuste to za 15 minut.');
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) throw new UnauthorizedException('Nesprávný e-mail nebo heslo.');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Účet je zablokován. Kontaktujte podporu.');
    await this.redis.del(key);
    return user;
  }

  async createSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
    await this.prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
    await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
    return { token, expiresAt };
  }

  async revokeSession(token: string) {
    const h = hashToken(token);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: h }, data: { revokedAt: new Date() } });
    await this.redis.del(`sess:${h}`);
  }

  async revokeAll(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({ where: { userId, revokedAt: null } });
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await Promise.all(sessions.map((s) => this.redis.del(`sess:${s.tokenHash}`)));
  }

  private async issueToken(userId: string, type: TokenType, ttlMin: number, numeric = false) {
    const code = numeric ? String(randomInt(100000, 999999)) : randomBytes(24).toString('base64url');
    await this.prisma.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.verificationToken.create({ data: { userId, type, codeHash: hashToken(code), expiresAt: new Date(Date.now() + ttlMin * 6e4) } });
    return code;
  }

  private async consumeToken(type: TokenType, code: string, userId?: string) {
    const t = await this.prisma.verificationToken.findFirst({ where: { type, codeHash: hashToken(code), usedAt: null, ...(userId ? { userId } : {}) } });
    if (!t || t.expiresAt < new Date()) throw new BadRequestException('Kód je neplatný nebo vypršel.');
    await this.prisma.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
    return t;
  }

  async sendEmailVerification(user: User) {
    const token = await this.issueToken(user.id, 'EMAIL_VERIFY', 60 * 48);
    const link = `${config.webOrigin}/overeni-emailu?token=${token}`;
    await this.mail.send(user.email, 'Potvrďte svůj e-mail – Dejinzerat.cz',
      `<p>Dobrý den, ${user.name},</p><p>potvrďte prosím svůj e-mail kliknutím na odkaz:</p><p><a href="${link}">${link}</a></p>`);
  }

  async verifyEmail(token: string) {
    const t = await this.consumeToken('EMAIL_VERIFY', token);
    await this.prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
    await this.flushUser(t.userId);
  }

  async sendPhoneCode(userId: string, phone: string) {
    if ((await this.redis.incr(`sms:${userId}`, 3600)) > 5) throw new BadRequestException('Příliš mnoho SMS. Zkuste to za hodinu.');
    await this.prisma.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: null } });
    const code = await this.issueToken(userId, 'PHONE_VERIFY', 10, true);
    await this.sms.send(phone, `Dejinzerat.cz: váš ověřovací kód je ${code}`);
    return process.env.NODE_ENV !== 'production' ? { devCode: code } : {};
  }

  async verifyPhone(userId: string, code: string) {
    await this.consumeToken('PHONE_VERIFY', code, userId);
    await this.prisma.user.update({ where: { id: userId }, data: { phoneVerifiedAt: new Date() } });
    await this.flushUser(userId);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) return; // neprozrazujeme existenci účtu
    const token = await this.issueToken(user.id, 'PASSWORD_RESET', 60);
    const link = `${config.webOrigin}/obnova-hesla?token=${token}`;
    await this.mail.send(user.email, 'Obnova hesla – Dejinzerat.cz', `<p>Nové heslo si nastavíte zde (platí 1 hodinu):</p><p><a href="${link}">${link}</a></p>`);
  }

  async resetPassword(token: string, password: string) {
    const t = await this.consumeToken('PASSWORD_RESET', token);
    await this.prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await bcrypt.hash(password, 12) } });
    await this.revokeAll(t.userId);
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash && !(await bcrypt.compare(current, user.passwordHash))) throw new BadRequestException('Současné heslo není správné.');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  }

  /** Přihlášení přes Google (OAuth 2.0 / OpenID Connect). */
  googleAuthUrl(state: string) {
    const p = new URLSearchParams({
      client_id: config.google.clientId!, redirect_uri: `${config.webOrigin}/api/auth/google/callback`,
      response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  }

  async googleCallback(code: string) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ code, client_id: config.google.clientId!, client_secret: config.google.clientSecret!, redirect_uri: `${config.webOrigin}/api/auth/google/callback`, grant_type: 'authorization_code' }),
    });
    if (!r.ok) throw new UnauthorizedException('Přihlášení přes Google selhalo.');
    const { access_token } = (await r.json()) as { access_token: string };
    const info = (await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${access_token}` } })).json()) as { sub: string; email: string; email_verified: boolean; name: string; picture?: string };
    if (!info.email_verified) throw new UnauthorizedException('E-mail u Google účtu není ověřený.');
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ googleId: info.sub }, { email: info.email.toLowerCase() }] } });
    if (existing) {
      return this.prisma.user.update({ where: { id: existing.id }, data: { googleId: info.sub, emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), avatarUrl: existing.avatarUrl ?? info.picture } });
    }
    return this.prisma.user.create({ data: { email: info.email.toLowerCase(), name: info.name, googleId: info.sub, emailVerifiedAt: new Date(), avatarUrl: info.picture } });
  }

  async flushUser(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({ where: { userId, revokedAt: null }, select: { tokenHash: true } });
    await Promise.all(sessions.map((s) => this.redis.del(`sess:${s.tokenHash}`)));
  }
}
