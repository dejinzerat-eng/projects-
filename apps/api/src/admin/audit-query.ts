import type { Prisma } from '@prisma/client';
import { z } from 'zod';

/** Filtry auditního logu (čisté funkce, testy v audit-query.spec.ts). Datum je kalendářní den v českém čase. */
const day = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const text = (max: number) => z.string().trim().max(max).optional().catch(undefined).transform((v) => v || undefined);
export const AuditQuery = z.object({
  action: text(60), actor: text(120), targetType: text(40), targetId: text(120),
  from: day, to: day, cursor: text(200),
  limit: z.coerce.number().int().min(1).max(200).catch(50).default(50),
});
export type AuditQuery = z.infer<typeof AuditQuery>;

/** Půlnoc daného dne v Praze jako okamžik v UTC (zohlední letní čas). */
export function pragueMidnight(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const guess = Date.UTC(y, mo - 1, d);
  const check = new Date(guess);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(check).map((p) => [p.type, p.value]));
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (wall - guess));
}

/** Kurzor pro stránkování „podle klíče“ (createdAt + id), stabilní i při nových záznamech. */
export function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}
export function decodeCursor(cursor: string | undefined): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const createdAt = new Date(iso ?? '');
  return id && !Number.isNaN(createdAt.getTime()) ? { createdAt, id } : null;
}

export function auditWhere(q: AuditQuery): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (q.action) and.push({ action: { startsWith: q.action } });
  if (q.targetType) and.push({ targetType: { equals: q.targetType, mode: 'insensitive' } });
  if (q.targetId) and.push({ targetId: q.targetId });
  if (q.actor) and.push({ OR: [{ actorId: q.actor }, { actor: { email: { contains: q.actor, mode: 'insensitive' } } }, { actor: { name: { contains: q.actor, mode: 'insensitive' } } }] });
  const from = q.from ? pragueMidnight(q.from) : null;
  const toDay = q.to ? pragueMidnight(q.to) : null;
  // „do“ zahrnuje celý den: hranice je půlnoc následujícího dne
  const to = toDay ? pragueMidnight(new Date(toDay.getTime() + 36 * 3600e3).toISOString().slice(0, 10)) : null;
  if (from || to) and.push({ createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } });
  const c = decodeCursor(q.cursor);
  if (c) and.push({ OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }] });
  return and.length ? { AND: and } : {};
}
