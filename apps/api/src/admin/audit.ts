import { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/auth.guard';
import type { PrismaService } from '../common/prisma.service';

/** Zápis do auditního logu (kdo, co, nad čím, proč). */
export function audit(prisma: PrismaService, actor: Pick<AuthUser, 'id'>, action: string, targetType: string, targetId: string, meta?: unknown) {
  return prisma.auditLog.create({ data: { actorId: actor.id, action, targetType, targetId, meta: meta === undefined ? undefined : (meta as Prisma.InputJsonValue) } });
}

/** Nejdelší text, který se do auditu uloží celý; delší se zkrátí (audit nemá nést celé popisy inzerátů). */
export const AUDIT_TEXT_MAX = 300;

/** Zkrácená hodnota pro auditní log: dlouhý text se ořízne s poznámkou o původní délce, datum jako ISO. */
export function compactValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string' && v.length > AUDIT_TEXT_MAX) return `${v.slice(0, AUDIT_TEXT_MAX)}… (${v.length} znaků)`;
  return v ?? null;
}

/** Rozdíl dvou objektů po polích – do auditního logu se ukládá jen to, co se změnilo (dlouhé texty zkráceně). */
export function diff<T extends Record<string, unknown>>(before: T, after: Partial<T>) {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after) as (keyof T & string)[]) {
    const a = before[k], b = after[k];
    if (b === undefined) continue;
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) out[k] = { from: compactValue(a), to: compactValue(b) };
  }
  return out;
}

/** Validace IČO (8 číslic, kontrolní součet modulo 11). */
export function validIco(ico: string) {
  if (!/^\d{8}$/.test(ico)) return false;
  const d = ico.split('').map(Number);
  const sum = d.slice(0, 7).reduce((a, n, i) => a + n * (8 - i), 0);
  const c = (11 - (sum % 11)) % 10;
  return c === d[7];
}
