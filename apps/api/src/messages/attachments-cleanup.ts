import type { PrismaClient } from '@prisma/client';

/** Fotka nahraná do konverzace, ale neodeslaná, se po 24 hodinách smaže (záznam i soubor). */
export const UNSENT_ATTACHMENT_TTL_MS = 24 * 3600_000;

type Db = { messageAttachment: Pick<PrismaClient['messageAttachment'], 'findMany' | 'deleteMany'> };

/**
 * Úklid neodeslaných příloh. Záznam se maže jen pokud je stále neodeslaný (messageId null) – a soubor jen u záznamů,
 * které opravdu zmizely: když někdo přílohu odešle mezi výběrem a mazáním, jeho fotka zůstane.
 */
export async function cleanupUnsentAttachments(db: Db, storage: { deleteMany(urls: string[]): Promise<number> }, now = Date.now(), batch = 500) {
  const rows = await db.messageAttachment.findMany({
    where: { messageId: null, createdAt: { lt: new Date(now - UNSENT_ATTACHMENT_TTL_MS) } },
    select: { id: true, url: true }, orderBy: { createdAt: 'asc' }, take: batch,
  });
  if (!rows.length) return { records: 0, files: 0 };
  const ids = rows.map((r) => r.id);
  const { count } = await db.messageAttachment.deleteMany({ where: { id: { in: ids }, messageId: null } });
  const kept = new Set(count === rows.length ? [] : (await db.messageAttachment.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((r) => r.id));
  const files = await storage.deleteMany(rows.filter((r) => !kept.has(r.id)).map((r) => r.url));
  return { records: count, files };
}
