import { Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import type { PrismaService } from '../common/prisma.service';

/** Bezpečnostní události účtu zapisované do auditního logu (AuditLog, targetType USER). */
export type SecurityAction =
  | 'auth.register' | 'auth.login' | 'auth.login_failed' | 'auth.login_locked'
  | 'auth.password_change' | 'auth.password_reset'
  | 'auth.sessions_revoke_all' | 'auth.session_revoke'
  | 'auth.oauth_link' | 'auth.email_change' | 'auth.phone_verify'
  | 'account.delete' | 'account.gdpr_export';

export interface ClientInfo { ip?: string; userAgent?: string }

export function clientInfo(req?: Pick<Request, 'ip' | 'headers'>): ClientInfo {
  if (!req) return {};
  const ua = req.headers?.['user-agent'];
  return { ip: req.ip || undefined, userAgent: typeof ua === 'string' ? ua.slice(0, 400) : undefined };
}

const log = new Logger('Audit');

/** Zapíše událost; chyba zápisu nikdy nezastaví přihlášení ani jinou akci. */
export async function writeAudit(prisma: PrismaService, userId: string, action: SecurityAction, client: ClientInfo = {}, meta: Record<string, unknown> = {}) {
  try {
    const data = { ...meta, ...(client.ip ? { ip: client.ip } : {}), ...(client.userAgent ? { userAgent: client.userAgent } : {}) };
    await prisma.auditLog.create({ data: { actorId: userId, action, targetType: 'USER', targetId: userId, meta: data as Prisma.InputJsonValue } });
  } catch (e) {
    log.warn(`Audit ${action} se nepodařilo zapsat: ${(e as Error).message}`);
  }
}
