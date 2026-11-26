import type { PrismaClient } from '@prisma/client';

/** Počty nepřečtených zpráv a upozornění pro odznaky v hlavičce. */
export async function unreadCounts(db: Pick<PrismaClient, 'message' | 'notification'>, userId: string) {
  const [messages, notifications] = await Promise.all([
    db.message.count({ where: { readAt: null, senderId: { not: userId }, conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] } } }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { messages, notifications };
}
