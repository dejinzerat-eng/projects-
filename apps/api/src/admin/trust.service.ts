import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { TERMS_OUTDATED_MESSAGE, termsOutdated } from '../users/terms';
import { assessMessageRisk, HIGH_RISK_SCORE } from '../listings/moderation';

export const RESTRICT_REPORTERS = 3;
export const RESTRICT_WINDOW_DAYS = 7;
export const RESTRICT_FLAGGED_MESSAGES = 3;
export const RESTRICTED_MESSAGE = 'Váš účet je dočasně omezen a čeká na kontrolu moderátorem. Do té doby nelze zveřejňovat inzeráty ani psát zprávy. Pokud jde o omyl, kontaktujte podporu.';

/** Signály pro automatické omezení účtu (čistá funkce, testy v trust.spec.ts). */
export interface TrustSignals { distinctReporters?: number; riskScore?: number; riskWhat?: string; flaggedMessages24h?: number }
export function autoRestrictReason(s: TrustSignals): string | null {
  if ((s.distinctReporters ?? 0) >= RESTRICT_REPORTERS) return `Nahlášen ${s.distinctReporters} různými uživateli za posledních ${RESTRICT_WINDOW_DAYS} dní`;
  if ((s.riskScore ?? 0) >= HIGH_RISK_SCORE) return `Vysoce rizikový obsah (skóre ${s.riskScore})${s.riskWhat ? `: ${s.riskWhat}` : ''}`;
  if ((s.flaggedMessages24h ?? 0) >= RESTRICT_FLAGGED_MESSAGES) return `${s.flaggedMessages24h} podezřelé zprávy za 24 hodin`;
  return null;
}

/**
 * Automatické omezení podezřelých účtů. Omezený účet (UserStatus.RESTRICTED) zůstává přihlášen,
 * ale nesmí zveřejňovat inzeráty ani psát zprávy, dokud omezení nezruší moderátor.
 * Týká se jen běžných uživatelů – členy týmu automat neomezuje.
 */
@Injectable()
export class TrustService {
  private log = new Logger('Trust');
  constructor(private prisma: PrismaService) {}

  async isRestricted(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
    return u?.status === 'RESTRICTED';
  }

  /** Volá se před zveřejněním inzerátu a odesláním zprávy: účet nesmí být omezený a musí mít odsouhlasené aktuální podmínky. */
  async assertMayPost(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, termsVersion: true } });
    if (u?.status === 'RESTRICTED') throw new ForbiddenException(RESTRICTED_MESSAGE);
    if (u && termsOutdated(u.termsVersion, config.termsVersion)) throw new ForbiddenException({ message: TERMS_OUTDATED_MESSAGE, code: 'TERMS_OUTDATED' });
  }

  /** Počet různých oznamovatelů účtu (uživatel, jeho inzeráty a zprávy) za 7 dní, od posledního zrušení omezení. */
  async distinctReporters(userId: string) {
    const lastLift = await this.prisma.userRestriction.findFirst({ where: { userId, liftedAt: { not: null } }, orderBy: { liftedAt: 'desc' }, select: { liftedAt: true } });
    const windowStart = new Date(Date.now() - RESTRICT_WINDOW_DAYS * 864e5);
    const since = lastLift?.liftedAt && lastLift.liftedAt > windowStart ? lastLift.liftedAt : windowStart;
    const [row] = await this.prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT r."reporterId")::bigint AS n FROM "Report" r
      WHERE r."createdAt" >= ${since} AND r.status <> 'DISMISSED' AND r."reporterId" <> ${userId} AND (
        (r."targetType" = 'USER' AND r."targetId" = ${userId})
        OR (r."targetType" = 'LISTING' AND r."targetId" IN (SELECT id FROM "Listing" WHERE "userId" = ${userId}))
        OR (r."targetType" = 'MESSAGE' AND r."targetId" IN (SELECT id FROM "Message" WHERE "senderId" = ${userId})))`);
    return Number(row?.n ?? 0);
  }

  /** Po novém nahlášení: 3 různí oznamovatelé za 7 dní → omezení. */
  async afterReport(userId: string) {
    return this.restrictIf(userId, { distinctReporters: await this.distinctReporters(userId) });
  }

  /** Po uložení inzerátu s rizikovým skóre. */
  async afterRiskyContent(userId: string, score: number, what: string) {
    if (score < HIGH_RISK_SCORE) return false;
    return this.restrictIf(userId, { riskScore: score, riskWhat: what });
  }

  /** Po odeslání zprávy: vysoké riziko hned, jinak 3 podezřelé zprávy za 24 h. */
  async afterMessage(userId: string, body: string) {
    const risk = assessMessageRisk(body);
    if (!risk.labels.length) return false;
    if (risk.score >= HIGH_RISK_SCORE) return this.restrictIf(userId, { riskScore: risk.score, riskWhat: `zpráva (${risk.labels.join(', ')})` });
    const recent = await this.prisma.message.findMany({ where: { senderId: userId, createdAt: { gte: new Date(Date.now() - 864e5) } }, select: { body: true }, orderBy: { createdAt: 'desc' }, take: 200 });
    return this.restrictIf(userId, { flaggedMessages24h: recent.filter((m) => assessMessageRisk(m.body).labels.length > 0).length });
  }

  private async restrictIf(userId: string, signals: TrustSignals) {
    const reason = autoRestrictReason(signals);
    if (!reason) return false;
    return this.restrict(userId, reason, 'auto');
  }

  /** Omezí účet (jen aktivního běžného uživatele) a upozorní uživatele i moderátory. */
  async restrict(userId: string, reason: string, source: 'auto' | 'staff') {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true, status: true } });
    if (!u || u.status !== 'ACTIVE' || (source === 'auto' && u.role !== 'USER')) return false;
    const updated = await this.prisma.user.updateMany({ where: { id: userId, status: 'ACTIVE' }, data: { status: 'RESTRICTED' } });
    if (!updated.count) return false;
    await this.prisma.userRestriction.create({ data: { userId, source, reason } });
    await this.prisma.notification.create({ data: { userId, type: 'restriction', title: 'Váš účet byl dočasně omezen', body: RESTRICTED_MESSAGE, link: '/stranka/kontakt' } });
    const staff = await this.prisma.user.findMany({ where: { role: { in: ['MODERATOR', 'ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' }, select: { id: true }, take: 50 });
    if (staff.length) await this.prisma.notification.createMany({ data: staff.map((s) => ({ userId: s.id, type: 'admin-restriction', title: `Omezený účet ke kontrole: ${u.name}`, body: reason, link: '/admin/uzivatele?stav=RESTRICTED' })) });
    this.log.log(`Účet ${userId} omezen (${source}): ${reason}`);
    return true;
  }

  /** Zruší omezení; následné hodnocení nahlášení počítá jen nová nahlášení. */
  async lift(userId: string, actorId: string, note?: string) {
    await this.prisma.user.updateMany({ where: { id: userId, status: 'RESTRICTED' }, data: { status: 'ACTIVE' } });
    await this.prisma.userRestriction.updateMany({ where: { userId, liftedAt: null }, data: { liftedAt: new Date(), liftedById: actorId, liftNote: note } });
    await this.prisma.notification.create({ data: { userId, type: 'restriction', title: 'Omezení vašeho účtu bylo zrušeno', body: note ?? 'Děkujeme za trpělivost, účet můžete znovu plně používat.' } });
  }
}
