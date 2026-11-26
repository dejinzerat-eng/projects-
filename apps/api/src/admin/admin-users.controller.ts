import { BadGatewayException, BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ROLES, Role } from '@dej/shared';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { AuthUser, CurrentUser } from '../common/auth.guard';
import { Can } from '../common/permissions';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { SearchService } from '../search/search.service';
import { audit, diff, validIco } from './audit';
import { checkRoleChange, checkStatusChange } from './staff-policy';
import { TrustService } from './trust.service';

const USER_SELECT = {
  id: true, email: true, name: true, role: true, status: true, createdAt: true, lastSeenAt: true, lastActiveAt: true,
  phoneVerifiedAt: true, emailVerifiedAt: true, isBusiness: true, companyName: true, companyId: true, companyVerifiedAt: true,
  _count: { select: { listings: true, reports: true } },
} satisfies Prisma.UserSelect;

const StatusDto = z.object({ status: z.enum(['ACTIVE', 'BLOCKED', 'RESTRICTED']), reason: z.string().trim().max(500).optional() })
  .refine((d) => d.status === 'ACTIVE' || (d.reason?.length ?? 0) >= 3, { message: 'Uveďte důvod (alespoň 3 znaky).', path: ['reason'] });
const BusinessDto = z.object({
  verified: z.boolean().optional(), isBusiness: z.boolean().optional(),
  companyName: z.string().trim().min(2).max(120).optional(), companyId: z.string().trim().regex(/^\d{8}$/, 'IČO má 8 číslic.').optional(),
});

/** Uživatelé, role, blokace a omezení účtů; firemní účty. */
@Controller('admin')
export class AdminUsersController {
  constructor(private prisma: PrismaService, private auth: AuthService, private search: SearchService, private trust: TrustService) {}

  private superadmins() { return this.prisma.user.count({ where: { role: 'SUPERADMIN', status: 'ACTIVE' } }); }

  /**
   * Změna účtu hlavního administrátora: kontrola „posledního hlavního administrátora“ a zápis proběhnou v jedné transakci
   * se zámkem řádků, takže dva souběžné požadavky nemohou odebrat oba poslední hlavní administrátory.
   */
  private async superadminChange(check: (active: number) => string | null, data: Prisma.UserUpdateInput, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE role = 'SUPERADMIN' AND status = 'ACTIVE' FOR UPDATE`;
      const err = check(rows.length);
      if (err) throw new ForbiddenException(err);
      await tx.user.update({ where: { id }, data });
    });
  }
  private async target(id: string) {
    const t = await this.prisma.user.findUnique({ where: { id }, select: { id: true, role: true, status: true, email: true, name: true } });
    if (!t) throw new NotFoundException('Uživatel neexistuje.');
    return t;
  }

  @Can('users.read')
  @Get('users')
  async users(@Query('q') q?: string, @Query('stav') stav?: string) {
    const filter = z.enum(['ACTIVE', 'BLOCKED', 'RESTRICTED', 'STAFF', 'ALL']).catch('ALL').parse(stav ?? 'ALL');
    const rows = await this.prisma.user.findMany({
      where: {
        ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }, { id: q }, { companyId: q }] } : {}),
        ...(filter === 'STAFF' ? { role: { not: 'USER' } } : filter !== 'ALL' ? { status: filter } : {}),
      },
      select: USER_SELECT, orderBy: { createdAt: 'desc' }, take: 100,
    });
    const restrictions = await this.prisma.userRestriction.findMany({ where: { userId: { in: rows.filter((r) => r.status === 'RESTRICTED').map((r) => r.id) }, liftedAt: null }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ ...r, restriction: restrictions.find((x) => x.userId === r.id) ?? null }));
  }

  /** Detail pro podporu: inzeráty, nahlášení, historie omezení, relace. */
  @Can('users.read')
  @Get('users/:id')
  async user(@Param('id') id: string) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { ...USER_SELECT, phone: true, city: true } });
    if (!u) throw new NotFoundException('Uživatel neexistuje.');
    const [listings, restrictions, sessions, reportsAgainst, reporters7] = await Promise.all([
      this.prisma.listing.findMany({ where: { userId: id }, select: { id: true, slug: true, title: true, status: true, spamScore: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.userRestriction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      this.prisma.refreshToken.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.report.count({ where: { targetType: 'USER', targetId: id } }),
      this.trust.distinctReporters(id),
    ]);
    return { ...u, listings, restrictions, activeSessions: sessions, reportsAgainst, reporters7 };
  }

  /** Změna role. Administrátorské role smí měnit jen hlavní administrátor; vlastní roli ani posledního hlavního administrátora měnit nelze. */
  @Can('users.roles')
  @Patch('users/:id/role')
  async setRole(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ role: z.enum(ROLES) }))) dto: { role: Role }) {
    const t = await this.target(id);
    if (t.role === dto.role) return { ok: true };
    const err = checkRoleChange(u, t, dto.role, await this.superadmins());
    if (err) throw new ForbiddenException(err);
    if (t.role === 'SUPERADMIN') await this.superadminChange((n) => checkRoleChange(u, t, dto.role, n), { role: dto.role }, id);
    else await this.prisma.user.update({ where: { id }, data: { role: dto.role } });
    await this.auth.flushUser(id);
    await audit(this.prisma, u, 'user.role', 'user', id, { from: t.role, to: dto.role });
    return { ok: true };
  }

  /** Zablokování / odblokování / omezení / zrušení omezení. Moderátor smí jen běžné uživatele. */
  @Can('users.read')
  @Post('users/:id/status')
  async setStatus(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(StatusDto)) dto: z.infer<typeof StatusDto>) {
    const t = await this.target(id);
    if (t.status === dto.status) return { ok: true };
    const err = checkStatusChange(u, t, dto.status, await this.superadmins());
    if (err) throw new ForbiddenException(err);
    if (dto.status === 'BLOCKED') {
      if (t.role === 'SUPERADMIN') await this.superadminChange((n) => checkStatusChange(u, t, 'BLOCKED', n), { status: 'BLOCKED' }, id);
      else await this.prisma.user.update({ where: { id }, data: { status: 'BLOCKED' } });
      await this.prisma.userRestriction.updateMany({ where: { userId: id, liftedAt: null }, data: { liftedAt: new Date(), liftedById: u.id, liftNote: 'Účet zablokován' } });
      await this.auth.revokeAll(id);
      const ls = await this.prisma.listing.findMany({ where: { userId: id, status: 'ACTIVE' }, select: { id: true } });
      await this.prisma.listing.updateMany({ where: { userId: id, status: 'ACTIVE' }, data: { status: 'REJECTED', rejectReason: 'Účet zablokován' } });
      await Promise.all(ls.map((l) => this.search.index(l.id)));
    } else if (dto.status === 'RESTRICTED') {
      await this.trust.restrict(id, dto.reason!, 'staff');
    } else if (t.status === 'RESTRICTED') {
      await this.trust.lift(id, u.id, dto.reason);
    } else {
      await this.prisma.user.update({ where: { id }, data: { status: 'ACTIVE' } });
    }
    await this.auth.flushUser(id);
    await audit(this.prisma, u, `user.${dto.status === 'BLOCKED' ? 'block' : dto.status === 'RESTRICTED' ? 'restrict' : t.status === 'RESTRICTED' ? 'lift_restriction' : 'unblock'}`, 'user', id, { reason: dto.reason ?? null, from: t.status, to: dto.status });
    return { ok: true };
  }

  @Can('users.resendVerification')
  @Post('users/:id/resend-verification')
  async resendVerification(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Uživatel neexistuje.');
    if (user.emailVerifiedAt) throw new BadRequestException('E-mail je už ověřený.');
    await this.auth.sendEmailVerification(user);
    await audit(this.prisma, u, 'user.resend_verification', 'user', id);
    return { ok: true };
  }

  // ——— Firemní účty ———

  @Can('businesses.manage')
  @Get('businesses')
  async businesses(@Query('q') q?: string, @Query('overeni') overeni?: string) {
    const rows = await this.prisma.user.findMany({
      where: {
        OR: [{ isBusiness: true }, { companyId: { not: null } }],
        ...(overeni === 'ano' ? { companyVerifiedAt: { not: null } } : overeni === 'ne' ? { companyVerifiedAt: null } : {}),
        ...(q ? { AND: [{ OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }, { companyName: { contains: q, mode: 'insensitive' } }, { companyId: q }] }] } : {}),
      },
      select: { id: true, email: true, name: true, status: true, isBusiness: true, companyName: true, companyId: true, companyVerifiedAt: true, createdAt: true, _count: { select: { listings: { where: { status: 'ACTIVE' } } } } },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    return rows.map((r) => ({ ...r, activeListings: r._count.listings, icoValid: r.companyId ? validIco(r.companyId) : null }));
  }

  @Can('businesses.manage')
  @Patch('businesses/:id')
  async updateBusiness(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(BusinessDto)) dto: z.infer<typeof BusinessDto>) {
    const b = await this.prisma.user.findUnique({ where: { id }, select: { isBusiness: true, companyName: true, companyId: true, companyVerifiedAt: true } });
    if (!b) throw new NotFoundException('Účet neexistuje.');
    const ico = dto.companyId ?? b.companyId;
    if (dto.verified && !(ico && validIco(ico))) throw new BadRequestException('Nelze ověřit: IČO chybí nebo nemá platný kontrolní součet.');
    const { verified, ...rest } = dto;
    // Ruční ověření nepřepíše datum už ověřené firmy; změna IČO ověření vždy ruší
    const verifiedAt = verified === undefined ? undefined : verified ? (b.companyVerifiedAt ?? new Date()) : null;
    const data = { ...rest, ...(verifiedAt !== undefined ? { companyVerifiedAt: verifiedAt } : {}), ...(dto.companyId && dto.companyId !== b.companyId ? { companyVerifiedAt: null } : {}) };
    await this.prisma.user.update({ where: { id }, data });
    // Akce podle výsledného stavu (změna IČO spolu s ověřením ověření zruší, nejde tedy o ověření)
    const after = 'companyVerifiedAt' in data ? data.companyVerifiedAt : b.companyVerifiedAt;
    const action = !b.companyVerifiedAt && after ? 'business.verify' : b.companyVerifiedAt && !after ? 'business.unverify' : 'business.update';
    await audit(this.prisma, u, action, 'user', id, { ...dto, changes: diff(b as unknown as Record<string, unknown>, data) });
    return { ok: true };
  }

  /** Načte firmu z veřejného registru ARES (bez klíče) a při shodě IČO ji označí jako ověřenou. */
  @Can('businesses.manage')
  @Post('businesses/:id/ares')
  async ares(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const b = await this.prisma.user.findUnique({ where: { id }, select: { companyId: true } });
    if (!b?.companyId || !validIco(b.companyId)) throw new BadRequestException('Účet nemá platné IČO.');
    let data: { obchodniJmeno?: string; sidlo?: { textovaAdresa?: string } };
    try {
      const r = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${b.companyId}`, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(6000) });
      if (r.status === 404) throw new NotFoundException('Firma s tímto IČO v ARES neexistuje.');
      if (!r.ok) throw new Error(String(r.status));
      data = await r.json();
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new BadGatewayException('Registr ARES teď neodpovídá, zkuste to později.');
    }
    if (!data.obchodniJmeno) throw new NotFoundException('Firma s tímto IČO v ARES neexistuje.');
    await this.prisma.user.update({ where: { id }, data: { companyName: data.obchodniJmeno, companyVerifiedAt: new Date(), isBusiness: true } });
    await audit(this.prisma, u, 'business.verify_ares', 'user', id, { ico: b.companyId, name: data.obchodniJmeno, address: data.sidlo?.textovaAdresa });
    return { ok: true, name: data.obchodniJmeno, address: data.sidlo?.textovaAdresa ?? null };
  }
}
