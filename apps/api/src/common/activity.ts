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
    // Podmínka v DB drží limit i bez Redisu na více serverless instancích
    const now = new Date();
    await prisma.user.updateMany({ where: { id: userId, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: new Date(now.getTime() - ACTIVITY_INTERVAL_SEC * 1000) } }] }, data: { lastActiveAt: now } });
  } catch { /* statistika aktivity není kritická */ }
}
