import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus, ReportTarget } from '@prisma/client';
import { z } from 'zod';
import { AuthUser } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { TrustService } from './trust.service';

export const ReportDto = z.object({
  targetType: z.enum(['LISTING', 'USER', 'MESSAGE']), targetId: z.string().min(1).max(64),
  reason: z.string().trim().min(2).max(80), note: z.string().trim().max(1000).optional(),
});
export type ReportInput = z.infer<typeof ReportDto>;

export interface ReportRow { id: string; targetType: string; targetId: string; reporterId: string; createdAt: Date }
/** Seskupí otevřená nahlášení podle cíle (sloučení duplicit), nejvíce nahlašované nahoře. */
export function groupReports<T extends ReportRow>(rows: T[]) {
  const map = new Map<string, { key: string; targetType: string; targetId: string; reports: T[]; reporters: Set<string>; lastAt: Date }>();
  for (const r of rows) {
    const key = `${r.targetType}:${r.targetId}`;
    const g = map.get(key) ?? { key, targetType: r.targetType, targetId: r.targetId, reports: [], reporters: new Set<string>(), lastAt: r.createdAt };
    g.reports.push(r); g.reporters.add(r.reporterId);
    if (r.createdAt > g.lastAt) g.lastAt = r.createdAt;
    map.set(key, g);
  }
  return [...map.values()]
    .map(({ reporters, ...g }) => ({ ...g, count: g.reports.length, distinctReporters: reporters.size }))
    .sort((a, b) => b.distinctReporters - a.distinctReporters || b.lastAt.getTime() - a.lastAt.getTime());
}

const RESULT_TEXT: Record<'RESOLVED' | 'DISMISSED', string> = {
  RESOLVED: 'Děkujeme, vaše nahlášení jsme prověřili a zasáhli jsme.',
  DISMISSED: 'Vaše nahlášení jsme prověřili, ale porušení pravidel jsme nezjistili.',
};

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService, private trust: TrustService) {}

  /** Komu cíl nahlášení patří (pro automatické omezení a kontrolu nahlášení sebe sama). */
  private async ownerOf(type: ReportTarget, id: string, reporterId: string): Promise<string> {
    if (type === 'USER') {
      const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
      if (!u) throw new NotFoundException('Uživatel neexistuje.');
      return u.id;
    }
    if (type === 'LISTING') {
      const l = await this.prisma.listing.findUnique({ where: { id }, select: { userId: true, status: true } });
      if (!l || l.status === 'DELETED') throw new NotFoundException('Inzerát neexistuje.');
      return l.userId;
    }
    const m = await this.prisma.message.findUnique({ where: { id }, select: { senderId: true, conversation: { select: { buyerId: true, sellerId: true } } } });
    // Zprávu může nahlásit jen účastník konverzace
    if (!m || (m.conversation.buyerId !== reporterId && m.conversation.sellerId !== reporterId)) throw new NotFoundException('Zpráva neexistuje.');
    return m.senderId;
  }

  /** Nové nahlášení: bez nahlášení sebe sama, bez duplicit od stejného uživatele, s vyhodnocením automatického omezení. */
  async file(u: AuthUser, dto: ReportInput) {
    const ownerId = await this.ownerOf(dto.targetType, dto.targetId, u.id);
    if (ownerId === u.id) throw new BadRequestException('Nemůžete nahlásit sami sebe.');
    const dup = await this.prisma.report.findFirst({ where: { reporterId: u.id, targetType: dto.targetType, targetId: dto.targetId, status: 'OPEN' } });
    if (dup) {
      if (dto.note && dto.note !== dup.note) await this.prisma.report.update({ where: { id: dup.id }, data: { note: [dup.note, dto.note].filter(Boolean).join('\n').slice(0, 2000) } });
      return { ok: true, duplicate: true };
    }
    await this.prisma.report.create({ data: { ...dto, reporterId: u.id } });
    await this.trust.afterReport(ownerId).catch(() => false);
    return { ok: true };
  }

  async list(status: ReportStatus) {
    const rows = await this.prisma.report.findMany({
      where: { status }, include: { reporter: { select: { id: true, name: true, email: true } } },
      orderBy: status === 'OPEN' ? { createdAt: 'desc' } : { resolvedAt: 'desc' }, take: status === 'OPEN' ? 500 : 100,
    });
    const ids = (t: string) => [...new Set(rows.filter((r) => r.targetType === t).map((r) => r.targetId))];
    const resolverIds = [...new Set(rows.map((r) => r.resolvedById).filter((x): x is string => !!x))];
    const [ls, us, ms, resolvers] = await Promise.all([
      this.prisma.listing.findMany({ where: { id: { in: ids('LISTING') } }, select: { id: true, title: true, slug: true, status: true, userId: true, user: { select: { id: true, name: true, status: true, role: true } } } }),
      this.prisma.user.findMany({ where: { id: { in: ids('USER') } }, select: { id: true, name: true, email: true, status: true, role: true } }),
      this.prisma.message.findMany({ where: { id: { in: ids('MESSAGE') } }, select: { id: true, body: true, imageUrl: true, createdAt: true, conversationId: true, sender: { select: { id: true, name: true, email: true, status: true, role: true } }, conversation: { select: { listing: { select: { id: true, title: true, slug: true } } } } } }),
      this.prisma.user.findMany({ where: { id: { in: resolverIds } }, select: { id: true, name: true } }),
    ]);
    const target = (type: string, id: string) => ({
      listing: type === 'LISTING' ? ls.find((l) => l.id === id) : undefined,
      user: type === 'USER' ? us.find((x) => x.id === id) : undefined,
      message: type === 'MESSAGE' ? ms.find((m) => m.id === id) : undefined,
    });
    const flat = rows.map((r) => ({ ...r, resolvedBy: resolvers.find((x) => x.id === r.resolvedById) ?? null }));
    if (status !== 'OPEN') return { status, groups: [], history: flat.map((r) => ({ ...r, ...target(r.targetType, r.targetId) })) };
    return { status, history: [], groups: groupReports(flat).map((g) => ({ ...g, ...target(g.targetType, g.targetId) })) };
  }

  /** Vyřídí nahlášení a všechna další otevřená nahlášení stejného cíle (sloučené duplicity); oznamovatelům pošle výsledek. */
  async resolve(id: string, actor: AuthUser, status: 'RESOLVED' | 'DISMISSED', note?: string) {
    const r = await this.prisma.report.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Nahlášení neexistuje.');
    const open = await this.prisma.report.findMany({ where: { targetType: r.targetType, targetId: r.targetId, status: 'OPEN' }, select: { id: true, reporterId: true } });
    const ids = [...new Set([r.id, ...open.map((o) => o.id)])];
    await this.prisma.report.updateMany({ where: { id: { in: ids } }, data: { status, resolvedById: actor.id, resolvedAt: new Date(), resolutionNote: note || null } });
    const reporters = [...new Set([r.reporterId, ...open.map((o) => o.reporterId)])];
    const what = r.targetType === 'LISTING' ? 'inzerátu' : r.targetType === 'USER' ? 'uživatele' : 'zprávy';
    await this.prisma.notification.createMany({ data: reporters.map((userId) => ({ userId, type: 'report', title: `Vaše nahlášení ${what} bylo vyřízeno`, body: [RESULT_TEXT[status], note].filter(Boolean).join(' '), link: '/muj-ucet/upozorneni' })) });
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action: `report.${status.toLowerCase()}`, targetType: 'report', targetId: id, meta: { target: `${r.targetType}:${r.targetId}`, merged: ids.length, note: note ?? null } } });
    return { ok: true, merged: ids.length, notified: reporters.length };
  }
}
