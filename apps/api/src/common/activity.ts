import type { PrismaService } from './prisma.service';
import type { RedisService } from './redis.service';

export const ACTIVITY_INTERVAL_SEC = 600;

/**
 * Zapíše User.lastActiveAt nejvýše jednou za 10 minut na uživatele (zámek v Redisu, bez Redisu v paměti instance).
 * Volá ho AuthGuard pro každý přihlášený požadavek; slouží pro DAU/WAU/MAU v administraci. Chyby nikdy neshodí požadavek.
 */
export async function markActive(prisma: PrismaService, redis: RedisService, userId: string) {
  try {
    if (!(await redis.lock(`active:${userId}`, ACTIVITY_INTERVAL_SEC))) return;
    await prisma.user.updateMany({ where: { id: userId }, data: { lastActiveAt: new Date() } });
  } catch { /* statistika aktivity není kritická */ }
}
