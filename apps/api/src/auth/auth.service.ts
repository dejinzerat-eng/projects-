import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { TokenType, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomInt, sign, type JsonWebKey } from 'crypto';
import { hashToken } from '../common/auth.guard';
import { config } from '../common/config';
import { MailerService, SmsService } from '../common/mailer.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { ClientInfo, SecurityAction, writeAudit } from './audit';
import { describeDevice } from './device';
import { escapeHtml } from './html';
import { checkIdTokenClaims, verifyRs256 } from './jwt';
import { attemptsLeft, LOCK_MINUTES, LOCK_THRESHOLD, LOCK_WINDOW_MIN, lockedMessage, PHONE_MAX_ATTEMPTS } from './lockout';

const SESSION_DAYS = 30;

/** Chyba přihlášení přes Google/Apple; code se předá webu jako ?chyba=… */
export class OAuthError extends Error {
  constructor(public code: 'oauth' | 'blokovan' | 'email', message: string) { super(message); }
}

type Provider = 'google' | 'apple';

@Injectable()
export class AuthService {
  private log = new Logger('Auth');
  private appleKeys?: { keys: (JsonWebKey & { kid?: string })[]; at: number };

  constructor(private prisma: PrismaService, private mail: MailerService, private sms: SmsService, private redis: RedisService) {}

  audit(userId: string, action: SecurityAction, client: ClientInfo = {}, meta: Record<string, unknown> = {}) {
    return writeAudit(this.prisma, userId, action, client, meta);
  }

  /** E-mail s jednoduchým rámcem; text v `body` musí být už escapovaný. */
  private send(to: string, subject: string, body: string) {
    return this.mail.send(to, `${subject} – Dejinzerat.cz`, `${body}<p style="color:#667085;font-size:13px">Tým Dejinzerat.cz</p>`);
  }

  async register(email: string, password: string, name: string, client: ClientInfo = {}) {
    email = email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new BadRequestException('Účet s tímto e-mailem už existuje.');
    const user = await this.prisma.user.create({
      data: { email, name, passwordHash: await bcrypt.hash(password, 12), termsAcceptedAt: new Date(), termsVersion: config.termsVersion },
    });
    await this.audit(user.id, 'auth.register', client, { termsVersion: config.termsVersion });
    await this.sendEmailVerification(user);
    return user;
  }

  async login(email: string, password: string, client: ClientInfo = {}) {
    email = email.toLowerCase().trim();
    // 1) limit na IP + e-mail (Redis, bez něj paměť instance)
    const key = `login:${client.ip ?? ''}:${email}`;
    if ((await this.redis.incr(key, 900)) > 10) throw new HttpException('Příliš mnoho pokusů. Zkuste to za 15 minut.', HttpStatus.TOO_MANY_REQUESTS);
    const user = await this.prisma.user.findUnique({ where: { email } });
    // 2) uzamčení celého účtu (databáze, platí pro všechny IP)
    if (user?.lockedUntil && user.lockedUntil > new Date()) throw new HttpException(lockedMessage(user.lockedUntil), HttpStatus.LOCKED);
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      if (user) await this.loginFailed(user, client);
      throw new UnauthorizedException('Nesprávný e-mail nebo heslo.');
    }
    // RESTRICTED se přihlásit smí (jen nemůže zveřejňovat ani psát), BLOCKED ne
    if (user.status === 'BLOCKED') throw new UnauthorizedException('Účet je zablokován. Kontaktujte podporu.');
    if (user.failedLogins || user.lockedUntil) await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    await this.redis.del(key);
    return user;
  }

  /** Chybné heslo u existujícího účtu: čítač v databázi, po LOCK_THRESHOLD chybách za hodinu zámek na LOCK_MINUTES. */
  private async loginFailed(user: User, client: ClientInfo) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - LOCK_WINDOW_MIN * 60_000);
    const sel = { failedLogins: true } as const;
    const u = (await this.prisma.user.update({ where: { id: user.id, lastFailedLoginAt: { gt: cutoff } }, data: { failedLogins: { increment: 1 }, lastFailedLoginAt: now }, select: sel }).catch(() => null))
      ?? (await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 1, lastFailedLoginAt: now }, select: sel }));
    await this.audit(user.id, 'auth.login_failed', client, { attempt: u.failedLogins });
    if (u.failedLogins < LOCK_THRESHOLD) return;
    const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
    const r = await this.prisma.user.updateMany({ where: { id: user.id, failedLogins: { gte: LOCK_THRESHOLD } }, data: { failedLogins: 0, lockedUntil } });
    if (!r.count) return; // zamkl už souběžný požadavek
    await this.audit(user.id, 'auth.login_locked', client, { until: lockedUntil.toISOString() });
    await this.send(user.email, 'Účet byl dočasně uzamčen',
      `<p>Dobrý den, ${escapeHtml(user.name)},</p><p>do vašeho účtu se někdo ${LOCK_THRESHOLD}× pokusil přihlásit se špatným heslem, proto jsme přihlašování heslem na ${LOCK_MINUTES} minut zastavili.</p>` +
      `<p>Pokud jste to nebyli vy, doporučujeme si nastavit nové heslo: <a href="${config.webOrigin}/zapomenute-heslo">${config.webOrigin}/zapomenute-heslo</a></p>`);
  }

  /** Vytvoří session po přihlášení, zapíše audit a při novém zařízení pošle upozornění. */
  async loginSession(user: User, client: ClientInfo, method: 'password' | Provider) {
    const device = describeDevice(client.userAgent);
    const prev = await this.prisma.refreshToken.findMany({ where: { userId: user.id }, select: { userAgent: true }, orderBy: { createdAt: 'desc' }, take: 50 });
    const s = await this.createSession(user.id, client);
    await this.audit(user.id, 'auth.login', client, { method });
    if (prev.length && !prev.some((p) => describeDevice(p.userAgent) === device)) {
      await this.send(user.email, 'Nové přihlášení do účtu',
        `<p>Dobrý den, ${escapeHtml(user.name)},</p><p>do vašeho účtu se právě někdo přihlásil z nového zařízení: <b>${escapeHtml(device)}</b>${client.ip ? ` (IP ${escapeHtml(client.ip)})` : ''}.</p>` +
        `<p>Pokud jste to byli vy, nemusíte nic dělat. Jinak si v <a href="${config.webOrigin}/muj-ucet/nastaveni">nastavení účtu</a> odhlaste neznámá zařízení a změňte heslo.</p>`);
    }
    return s;
  }

  async createSession(userId: string, client: ClientInfo = {}) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
    const now = new Date();
    await this.prisma.refreshToken.create({ data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: client.userAgent, ip: client.ip, lastUsedAt: now } });
    await this.prisma.user.update({ where: { id: userId }, data: { lastSeenAt: now } });
    return { token, expiresAt };
  }

  async revokeSession(token: string) {
    const h = hashToken(token);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: h }, data: { revokedAt: new Date() } });
    await this.redis.del(`sess:${h}`);
  }

  /** Odhlásí všechna zařízení; s `keepToken` ponechá aktuální session. */
  async revokeAll(userId: string, keepToken?: string) {
    const keep = keepToken ? hashToken(keepToken) : undefined;
    const where = { userId, revokedAt: null, ...(keep ? { tokenHash: { not: keep } } : {}) };
    const sessions = await this.prisma.refreshToken.findMany({ where, select: { tokenHash: true } });
    await this.prisma.refreshToken.updateMany({ where, data: { revokedAt: new Date() } });
    await Promise.all(sessions.map((s) => this.redis.del(`sess:${s.tokenHash}`)));
    return sessions.length;
  }

  /** Přehled přihlášených zařízení pro nastavení účtu. */
  async listSessions(userId: string, currentToken?: string) {
    const cur = currentToken ? hashToken(currentToken) : '';
    const rows = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], take: 50,
    });
    return rows
      .map((r) => ({ id: r.id, device: describeDevice(r.userAgent), userAgent: r.userAgent, ip: r.ip, createdAt: r.createdAt, lastUsedAt: r.lastUsedAt ?? r.createdAt, current: r.tokenHash === cur }))
      .sort((a, b) => Number(b.current) - Number(a.current));
  }

  /** Odhlásí jedno zařízení; vrací true, pokud šlo o aktuální session. */
  async revokeSessionById(userId: string, id: string, currentToken?: string) {
    const s = await this.prisma.refreshToken.findFirst({ where: { id, userId, revokedAt: null } });
    if (!s) throw new BadRequestException('Toto přihlášení už neplatí.');
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
    await this.redis.del(`sess:${s.tokenHash}`);
    return !!currentToken && hashToken(currentToken) === s.tokenHash;
  }

  private async issueToken(userId: string, type: TokenType, ttlMin: number, opts: { numeric?: boolean; target?: string } = {}) {
    const code = opts.numeric ? String(randomInt(100000, 1000000)) : randomBytes(24).toString('base64url');
    await this.prisma.verificationToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.verificationToken.create({ data: { userId, type, codeHash: hashToken(code), target: opts.target, expiresAt: new Date(Date.now() + ttlMin * 6e4) } });
    return code;
  }

  private async consumeToken(type: TokenType, code: string, userId?: string) {
    const t = await this.prisma.verificationToken.findFirst({ where: { type, codeHash: hashToken(code), usedAt: null, ...(userId ? { userId } : {}) } });
    if (!t || t.expiresAt < new Date()) throw new BadRequestException('Kód je neplatný nebo vypršel.');
    const r = await this.prisma.verificationToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
    if (!r.count) throw new BadRequestException('Kód je neplatný nebo vypršel.');
    return t;
  }

  async sendEmailVerification(user: User) {
    const token = await this.issueToken(user.id, 'EMAIL_VERIFY', 60 * 48);
    const link = `${config.webOrigin}/overeni-emailu?token=${token}`;
    await this.send(user.email, 'Potvrďte svůj e-mail',
      `<p>Dobrý den, ${escapeHtml(user.name)},</p><p>potvrďte prosím svůj e-mail kliknutím na odkaz:</p><p><a href="${link}">${link}</a></p>`);
  }

  async verifyEmail(token: string) {
    const t = await this.consumeToken('EMAIL_VERIFY', token);
    await this.prisma.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } });
    await this.flushUser(t.userId);
  }

  /** Změna e-mailu: odkaz se pošle na novou adresu, změna platí až po jeho otevření. */
  async requestEmailChange(userId: string, newEmail: string, password: string | undefined) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash && !(password && (await bcrypt.compare(password, user.passwordHash)))) throw new BadRequestException('Heslo není správné.');
    const email = newEmail.toLowerCase().trim();
    if (email === user.email) throw new BadRequestException('Tento e-mail už u účtu máte.');
    if (await this.prisma.user.findUnique({ where: { email } })) throw new BadRequestException('Tento e-mail už používá jiný účet.');
    if ((await this.prisma.verificationToken.count({ where: { userId, type: 'EMAIL_CHANGE', createdAt: { gt: new Date(Date.now() - 3600_000) } } })) >= 5) {
      throw new BadRequestException('Příliš mnoho žádostí o změnu e-mailu. Zkuste to za hodinu.');
    }
    const token = await this.issueToken(userId, 'EMAIL_CHANGE', 60 * 24, { target: email });
    const link = `${config.webOrigin}/overeni-emailu?token=${token}&zmena=1`;
    await this.send(email, 'Potvrďte nový e-mail',
      `<p>Dobrý den, ${escapeHtml(user.name)},</p><p>pro dokončení změny e-mailu u účtu na Dejinzerat.cz otevřete tento odkaz (platí 24 hodin):</p><p><a href="${link}">${link}</a></p>`);
    await this.send(user.email, 'Žádost o změnu e-mailu',
      `<p>Dobrý den, ${escapeHtml(user.name)},</p><p>u vašeho účtu někdo požádal o změnu e-mailu na <b>${escapeHtml(email)}</b>. Změna proběhne až po potvrzení z nové adresy.</p>` +
      `<p>Pokud jste to nebyli vy, změňte si prosím heslo a v nastavení účtu odhlaste ostatní zařízení.</p>`);
    return { email };
  }

  async confirmEmailChange(token: string, client: ClientInfo = {}) {
    const t = await this.consumeToken('EMAIL_CHANGE', token);
    if (!t.target) throw new BadRequestException('Kód je neplatný nebo vypršel.');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: t.userId } });
    if (await this.prisma.user.findFirst({ where: { email: t.target, id: { not: user.id } } })) throw new BadRequestException('Tento e-mail mezitím začal používat jiný účet.');
    await this.prisma.user.update({ where: { id: user.id }, data: { email: t.target, emailVerifiedAt: new Date() } });
    await this.flushUser(user.id);
    await this.audit(user.id, 'auth.email_change', client, { from: user.email, to: t.target });
    await this.send(user.email, 'E-mail účtu byl změněn',
      `<p>Dobrý den, ${escapeHtml(user.name)},</p><p>e-mail vašeho účtu byl změněn na <b>${escapeHtml(t.target)}</b>. Na tuto adresu už zprávy posílat nebudeme.</p>` +
      `<p>Pokud jste změnu neprovedli vy, ozvěte se nám co nejdříve odpovědí na tento e-mail.</p>`);
  }

  async sendPhoneCode(userId: string, phone: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.phone === phone && user.phoneVerifiedAt) throw new BadRequestException('Toto číslo už máte ověřené.');
    if (await this.prisma.user.findFirst({ where: { phone, phoneVerifiedAt: { not: null }, id: { not: userId } } })) throw new BadRequestException('Toto číslo už je ověřené u jiného účtu.');
    // limit SMS na uživatele z databáze (funguje i bez Redisu na více instancích)
    if ((await this.prisma.verificationToken.count({ where: { userId, type: 'PHONE_VERIFY', createdAt: { gt: new Date(Date.now() - 3600_000) } } })) >= 5) {
      throw new BadRequestException('Příliš mnoho SMS. Zkuste to za hodinu.');
    }
    // číslo se k účtu uloží až po ověření kódu
    const code = await this.issueToken(userId, 'PHONE_VERIFY', 10, { numeric: true, target: phone });
    await this.sms.send(phone, `Dejinzerat.cz: váš ověřovací kód je ${code}`);
    return process.env.NODE_ENV !== 'production' && !this.sms.enabled ? { devCode: code } : {};
  }

  /** Ověření kódu z SMS. Každý pokus se počítá; po PHONE_MAX_ATTEMPTS chybách kód přestane platit. */
  async verifyPhone(userId: string, code: string, client: ClientInfo = {}) {
    const t = await this.prisma.verificationToken.findFirst({ where: { userId, type: 'PHONE_VERIFY', usedAt: null }, orderBy: { createdAt: 'desc' } });
    if (!t || t.expiresAt < new Date()) throw new BadRequestException('Kód už neplatí. Pošlete si prosím nový.');
    const n = await this.prisma.verificationToken.update({ where: { id: t.id, usedAt: null }, data: { attempts: { increment: 1 } }, select: { attempts: true } }).catch(() => null);
    if (!n || n.attempts > PHONE_MAX_ATTEMPTS) throw new BadRequestException('Kód už neplatí. Pošlete si prosím nový.');
    if (hashToken(code) !== t.codeHash) {
      if (n.attempts >= PHONE_MAX_ATTEMPTS) {
        await this.prisma.verificationToken.update({ where: { id: t.id }, data: { usedAt: new Date() } });
        throw new BadRequestException(`Kód jste zadali ${PHONE_MAX_ATTEMPTS}× špatně, a proto přestal platit. Pošlete si prosím nový.`);
      }
      throw new BadRequestException(`Kód není správný. ${attemptsLeft(PHONE_MAX_ATTEMPTS - n.attempts)}.`);
    }
    const r = await this.prisma.verificationToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
    if (!r.count) throw new BadRequestException('Kód už neplatí. Pošlete si prosím nový.');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const phone = t.target ?? user.phone;
    if (!phone) throw new BadRequestException('Kód už neplatí. Pošlete si prosím nový.');
    if (await this.prisma.user.findFirst({ where: { phone, phoneVerifiedAt: { not: null }, id: { not: userId } } })) throw new BadRequestException('Toto číslo už je ověřené u jiného účtu.');
    await this.prisma.user.update({ where: { id: userId }, data: { phone, phoneVerifiedAt: new Date() } });
    await this.flushUser(userId);
    await this.audit(userId, 'auth.phone_verify', client, { phone: `…${phone.slice(-3)}` });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || user.status === 'BLOCKED') return; // neprozrazujeme existenci účtu
    const token = await this.issueToken(user.id, 'PASSWORD_RESET', 60);
    const link = `${config.webOrigin}/obnova-hesla?token=${token}`;
    await this.send(user.email, 'Obnova hesla', `<p>Nové heslo si nastavíte zde (platí 1 hodinu):</p><p><a href="${link}">${link}</a></p><p>Pokud jste o obnovu nežádali, e-mail ignorujte.</p>`);
  }

  async resetPassword(token: string, password: string, client: ClientInfo = {}) {
    const t = await this.consumeToken('PASSWORD_RESET', token);
    // obnova hesla přes e-mail zároveň odemkne účet uzamčený po chybných pokusech
    // odkaz přišel e-mailem, takže vlastník adresu zároveň ověřil
    const prev = await this.prisma.user.findUniqueOrThrow({ where: { id: t.userId }, select: { emailVerifiedAt: true } });
    const user = await this.prisma.user.update({
      where: { id: t.userId },
      data: { passwordHash: await bcrypt.hash(password, 12), failedLogins: 0, lockedUntil: null, ...(prev.emailVerifiedAt ? {} : { emailVerifiedAt: new Date() }) },
    });
    const n = await this.revokeAll(t.userId);
    await this.audit(user.id, 'auth.password_reset', client, { revokedSessions: n });
    await this.send(user.email, 'Heslo bylo změněno', `<p>Dobrý den, ${escapeHtml(user.name)},</p><p>heslo k vašemu účtu bylo právě nastaveno přes odkaz pro obnovu a všechna zařízení byla odhlášena.</p>`);
  }

  async changePassword(userId: string, current: string, next: string, currentToken: string | undefined, client: ClientInfo = {}) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.passwordHash && !(await bcrypt.compare(current, user.passwordHash))) throw new BadRequestException('Současné heslo není správné.');
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 12) } });
    // ostatní zařízení odhlásíme, aktuální zůstane přihlášené
    const n = await this.revokeAll(userId, currentToken);
    await this.audit(userId, 'auth.password_change', client, { revokedSessions: n, firstPassword: !user.passwordHash });
    await this.send(user.email, user.passwordHash ? 'Heslo bylo změněno' : 'Heslo bylo nastaveno',
      `<p>Dobrý den, ${escapeHtml(user.name)},</p><p>heslo k vašemu účtu bylo právě ${user.passwordHash ? 'změněno' : 'nastaveno'}${n ? ' a ostatní zařízení byla odhlášena' : ''}.</p>` +
      `<p>Pokud jste to nebyli vy, obnovte si heslo: <a href="${config.webOrigin}/zapomenute-heslo">${config.webOrigin}/zapomenute-heslo</a></p>`);
    return { revoked: n };
  }

  /** Potvrzení citlivé akce heslem (např. smazání účtu). Účet bez hesla (jen Google/Apple) heslo nemá. */
  async assertPassword(userId: string, password?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
    if (user.passwordHash && !(password && (await bcrypt.compare(password, user.passwordHash)))) throw new BadRequestException('Heslo není správné.');
  }

  /**
   * Napárování účtu Google/Apple. Existující účet se stejným e-mailem, který nikdy nebyl ověřený,
   * mohl založit kdokoli (obsazení účtu předem): takovému účtu smažeme heslo, telefon a odhlásíme všechna zařízení.
   */
  async linkOAuth(provider: Provider, p: { sub: string; email?: string; emailVerified: boolean; name?: string; picture?: string }, client: ClientInfo = {}) {
    const byId = provider === 'google' ? { googleId: p.sub } : { appleId: p.sub };
    let user = await this.prisma.user.findUnique({ where: byId });
    if (!user) {
      if (!p.email || !p.emailVerified) throw new OAuthError('email', `${provider === 'google' ? 'Google' : 'Apple'} nesdílel ověřený e-mail.`);
      const email = p.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing) {
        if (existing.status === 'BLOCKED') throw new OAuthError('blokovan', 'Účet je zablokován.');
        const takeover = !existing.emailVerifiedAt;
        user = await this.prisma.user.update({
          where: { id: existing.id },
          data: {
            ...byId, emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), avatarUrl: existing.avatarUrl ?? p.picture,
            ...(takeover ? { passwordHash: null, phone: null, phoneVerifiedAt: null, failedLogins: 0, lockedUntil: null } : {}),
          },
        });
        if (takeover) {
          await this.revokeAll(existing.id);
          await this.prisma.verificationToken.updateMany({ where: { userId: existing.id, usedAt: null }, data: { usedAt: new Date() } });
        }
        await this.audit(existing.id, 'auth.oauth_link', client, { provider, unverifiedAccountReset: takeover });
      } else {
        user = await this.prisma.user.create({
          data: { email, name: (p.name || 'Uživatel').slice(0, 60), ...byId, emailVerifiedAt: new Date(), avatarUrl: p.picture, termsAcceptedAt: new Date(), termsVersion: config.termsVersion },
        });
        await this.audit(user.id, 'auth.register', client, { provider, termsVersion: config.termsVersion });
      }
    }
    if (user.status === 'BLOCKED') throw new OAuthError('blokovan', 'Účet je zablokován.');
    return user;
  }

  /** Přihlášení přes Google (OAuth 2.0 / OpenID Connect). */
  googleAuthUrl(state: string) {
    const p = new URLSearchParams({
      client_id: config.google.clientId!, redirect_uri: `${config.webOrigin}/api/auth/google/callback`,
      response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
  }

  async googleCallback(code: string, client: ClientInfo = {}) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: new URLSearchParams({ code, client_id: config.google.clientId!, client_secret: config.google.clientSecret!, redirect_uri: `${config.webOrigin}/api/auth/google/callback`, grant_type: 'authorization_code' }),
    });
    if (!r.ok) throw new OAuthError('oauth', `Google token ${r.status}`);
    const { access_token } = (await r.json()) as { access_token?: string };
    if (!access_token) throw new OAuthError('oauth', 'Google nevrátil access_token.');
    const ui = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${access_token}` } });
    if (!ui.ok) throw new OAuthError('oauth', `Google userinfo ${ui.status}`);
    const info = (await ui.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (!info.sub) throw new OAuthError('oauth', 'Google nevrátil identitu.');
    return this.linkOAuth('google', { sub: info.sub, email: info.email, emailVerified: info.email_verified === true, name: info.name, picture: info.picture }, client);
  }

  /** Přihlášení přes Apple (Sign in with Apple, webový tok s response_mode=form_post). */
  appleRedirectUri() { return `${config.webOrigin}/api/auth/apple/callback`; }

  appleAuthUrl(state: string, nonce: string) {
    const p = new URLSearchParams({
      client_id: config.apple.clientId!, redirect_uri: this.appleRedirectUri(),
      response_type: 'code', response_mode: 'form_post', scope: 'name email', state, nonce,
    });
    return `https://appleid.apple.com/auth/authorize?${p}`;
  }

  /** client_secret pro Apple je krátkodobý JWT podepsaný klíčem .p8 (ES256). */
  private appleClientSecret() {
    const b64 = (v: object | Buffer) => (Buffer.isBuffer(v) ? v : Buffer.from(JSON.stringify(v))).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const head = b64({ alg: 'ES256', kid: config.apple.keyId });
    const body = b64({ iss: config.apple.teamId, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: config.apple.clientId });
    const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key: config.apple.privateKey!, dsaEncoding: 'ieee-p1363' });
    return `${head}.${body}.${b64(sig)}`;
  }

  /** Veřejné klíče Apple pro ověření podpisu id_tokenu (cache 1 h). */
  private async appleJwks(force = false) {
    if (!force && this.appleKeys && Date.now() - this.appleKeys.at < 3600_000) return this.appleKeys.keys;
    const r = await fetch('https://appleid.apple.com/auth/keys');
    if (!r.ok) throw new OAuthError('oauth', `Apple keys ${r.status}`);
    const { keys } = (await r.json()) as { keys: (JsonWebKey & { kid?: string })[] };
    this.appleKeys = { keys, at: Date.now() };
    return keys;
  }

  async appleCallback(code: string, userJson: string | undefined, nonce: string, client: ClientInfo = {}) {
    const r = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: config.apple.clientId!, client_secret: this.appleClientSecret(), code, grant_type: 'authorization_code', redirect_uri: this.appleRedirectUri() }),
    });
    if (!r.ok) throw new OAuthError('oauth', `Apple token ${r.status}`);
    const { id_token } = (await r.json()) as { id_token?: string };
    if (!id_token) throw new OAuthError('oauth', 'Apple nevrátil id_token.');
    let claims;
    try {
      try { claims = verifyRs256(id_token, await this.appleJwks()); } catch (e) {
        if ((e as Error).message !== 'Neznámý klíč tokenu.') throw e;
        claims = verifyRs256(id_token, await this.appleJwks(true)); // Apple mohl klíče vyměnit
      }
      checkIdTokenClaims(claims, { iss: 'https://appleid.apple.com', aud: config.apple.clientId!, nonce });
    } catch (e) {
      if (e instanceof OAuthError) throw e;
      throw new OAuthError('oauth', `Apple id_token: ${(e as Error).message}`);
    }
    let name: string | undefined;
    try {
      const u = userJson ? (JSON.parse(userJson) as { name?: { firstName?: string; lastName?: string } }) : undefined;
      name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' ').trim() || undefined;
    } catch { /* jméno posílá Apple jen při prvním přihlášení */ }
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    return this.linkOAuth('apple', { sub: claims.sub!, email: claims.email, emailVerified: verified, name: name ?? 'Uživatel Apple' }, client);
  }

  async flushUser(userId: string) {
    const sessions = await this.prisma.refreshToken.findMany({ where: { userId, revokedAt: null }, select: { tokenHash: true } });
    await Promise.all(sessions.map((s) => this.redis.del(`sess:${s.tokenHash}`)));
  }

  logError(e: unknown) { this.log.warn(`OAuth: ${(e as Error)?.message ?? e}`); }
}
