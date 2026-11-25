import type { PrismaClient } from '@prisma/client';

type Db = Pick<PrismaClient, 'user' | 'listing' | 'listingImage' | 'favorite' | 'followSeller' | 'savedSearch' | 'conversation' | 'message' | 'notification' | 'report' | 'review' | 'block' | 'refreshToken' | 'verificationToken' | 'auditLog'>;

/** Pole uživatele v exportu. Hesla, tokeny ani kódy se nikdy neexportují (jen informace, že existují). */
export const EXPORT_USER_SELECT = {
  id: true, email: true, name: true, role: true, status: true, phone: true, phoneVerifiedAt: true, emailVerifiedAt: true, showPhone: true,
  avatarUrl: true, bio: true, city: true, region: true, createdAt: true, updatedAt: true, lastSeenAt: true,
  isBusiness: true, companyName: true, companyId: true, companyAddress: true, vatId: true, companyVerifiedAt: true,
  passwordHash: true, googleId: true, appleId: true,
} as const;

const SECRET_KEYS = ['passwordHash', 'tokenHash', 'codeHash'];
/** Pojistka: z výsledného exportu odstraní jakékoli tajné klíče, kdyby se do dotazů někdy dostaly. */
export function stripSecrets<T>(v: T): T {
  if (Array.isArray(v)) return v.map(stripSecrets) as T;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    return Object.fromEntries(Object.entries(v).filter(([k]) => !SECRET_KEYS.includes(k)).map(([k, x]) => [k, stripSecrets(x)])) as T;
  }
  return v;
}

const person = { select: { id: true, name: true } } as const;

/** GDPR čl. 15 a 20: kompletní export osobních údajů uživatele ve strojově čitelné podobě. */
export async function buildExport(db: Db, userId: string, now = new Date()) {
  const u = await db.user.findUnique({ where: { id: userId }, select: EXPORT_USER_SELECT });
  if (!u) return null;
  const [listings, uploads, favorites, following, followers, savedSearches, conversations, notifications, reports, reviewsGiven, reviewsReceived, blocks, sessions, codes, audit] = await Promise.all([
    db.listing.findMany({ where: { userId }, include: { images: { select: { url: true, thumbUrl: true, width: true, height: true, position: true, createdAt: true }, orderBy: { position: 'asc' } }, category: { select: { slug: true, name: true } } }, orderBy: { createdAt: 'asc' } }),
    db.listingImage.findMany({ where: { ownerId: userId, listingId: null }, select: { url: true, thumbUrl: true, createdAt: true } }),
    db.favorite.findMany({ where: { userId }, select: { createdAt: true, listing: { select: { id: true, title: true } } } }),
    db.followSeller.findMany({ where: { followerId: userId }, select: { createdAt: true, seller: person } }),
    db.followSeller.count({ where: { sellerId: userId } }),
    db.savedSearch.findMany({ where: { userId }, select: { id: true, name: true, query: true, notify: true, lastCheckedAt: true, createdAt: true } }),
    db.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      select: { id: true, createdAt: true, lastMessageAt: true, buyerId: true, listing: { select: { id: true, title: true } }, buyer: person, seller: person,
        messages: { select: { id: true, senderId: true, body: true, imageUrl: true, readAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    db.notification.findMany({ where: { userId }, select: { type: true, title: true, body: true, link: true, readAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    db.report.findMany({ where: { reporterId: userId }, select: { id: true, targetType: true, targetId: true, reason: true, note: true, status: true, resolvedAt: true, createdAt: true } }),
    db.review.findMany({ where: { authorId: userId }, select: { id: true, rating: true, text: true, createdAt: true, seller: person, conversation: { select: { listing: { select: { id: true, title: true } } } } } }),
    db.review.findMany({ where: { sellerId: userId }, select: { id: true, rating: true, text: true, createdAt: true, author: person, conversation: { select: { listing: { select: { id: true, title: true } } } } } }),
    db.block.findMany({ where: { blockerId: userId }, select: { createdAt: true, blocked: person } }),
    db.refreshToken.findMany({ where: { userId }, select: { id: true, createdAt: true, expiresAt: true, revokedAt: true }, orderBy: { createdAt: 'desc' } }),
    db.verificationToken.findMany({ where: { userId }, select: { type: true, createdAt: true, expiresAt: true, usedAt: true }, orderBy: { createdAt: 'desc' } }),
    db.auditLog.findMany({ where: { actorId: userId }, select: { action: true, targetType: true, targetId: true, meta: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  // Zásahy administrátorů do účtu a inzerátů uživatele (bez identity administrátora)
  const auditAbout = await db.auditLog.findMany({
    where: { OR: [{ targetType: 'user', targetId: userId }, { targetType: 'listing', targetId: { in: listings.map((l) => l.id) } }] },
    select: { action: true, targetType: true, targetId: true, meta: true, createdAt: true }, orderBy: { createdAt: 'asc' },
  });
  const { passwordHash, googleId, appleId, isBusiness, companyName, companyId, companyAddress, vatId, companyVerifiedAt, showPhone, ...account } = u;
  const signup = passwordHash ? 'registrace e-mailem a heslem' : googleId ? 'přihlášení přes Google' : appleId ? 'přihlášení přes Apple' : 'neznámý';

  return stripSecrets({
    exportedAt: now.toISOString(),
    about: 'Export všech osobních údajů, které o vás Dejinzerat.cz uchovává (čl. 15 a 20 GDPR). Hesla, přihlašovací tokeny a ověřovací kódy neexportujeme – uchováváme je jen v nevratně zašifrované podobě.',
    account: { ...account, hasPassword: !!passwordHash, linkedAccounts: { google: !!googleId, apple: !!appleId } },
    company: { isBusiness, companyName, companyId, companyAddress, vatId, companyVerifiedAt },
    consents: {
      termsAndPrivacy: { acceptedAt: u.createdAt, method: signup, note: 'Souhlas s podmínkami a zásadami ochrany osobních údajů je podmínkou registrace.' },
      showPhoneOnListings: showPhone,
      savedSearchAlerts: savedSearches.map((s) => ({ name: s.name, emailNotifications: s.notify })),
    },
    listings,
    uploadedImagesWithoutListing: uploads,
    favorites,
    following,
    followersCount: followers,
    savedSearches,
    conversations: conversations.map(({ buyerId, messages, ...c }) => ({
      ...c, role: buyerId === userId ? 'kupující' : 'prodávající',
      messages: messages.map(({ senderId, ...m }) => ({ ...m, direction: senderId === userId ? 'odeslaná' : 'přijatá' })),
    })),
    messageCounts: {
      sent: conversations.reduce((n, c) => n + c.messages.filter((m) => m.senderId === userId).length, 0),
      received: conversations.reduce((n, c) => n + c.messages.filter((m) => m.senderId !== userId).length, 0),
    },
    notifications,
    reportsFiled: reports,
    reviewsGiven,
    reviewsReceived,
    blockedUsers: blocks,
    sessions,
    verificationCodes: codes,
    adminActions: audit,
    moderationOfYourAccount: auditAbout,
  });
}

/** Smazání účtu: osobní údaje se anonymizují, vazby (oblíbené, sledování, hledání…) se odstraní. */
export function anonymizeOps(db: Db, userId: string) {
  return [
    db.listing.updateMany({ where: { userId }, data: { status: 'DELETED' } }),
    db.message.updateMany({ where: { senderId: userId }, data: { body: '[Zpráva byla smazána]', imageUrl: null } }),
    db.favorite.deleteMany({ where: { userId } }),
    db.followSeller.deleteMany({ where: { OR: [{ followerId: userId }, { sellerId: userId }] } }),
    db.savedSearch.deleteMany({ where: { userId } }),
    db.notification.deleteMany({ where: { userId } }),
    db.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
    db.verificationToken.deleteMany({ where: { userId } }),
    db.listingImage.deleteMany({ where: { ownerId: userId, listingId: null } }),
    db.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@dejinzerat.invalid`, name: 'Smazaný uživatel', phone: null, phoneVerifiedAt: null, emailVerifiedAt: null, showPhone: false,
        bio: null, avatarUrl: null, passwordHash: null, googleId: null, appleId: null, city: null, region: null, lastSeenAt: null,
        isBusiness: false, companyName: null, companyId: null, companyAddress: null, vatId: null, companyVerifiedAt: null, status: 'BLOCKED',
      },
    }),
  ];
}

/** Doby uchování: použité/expirované kódy 30 dní, odhlášené/expirované relace 90 dní, auditní záznamy 24 měsíců. */
export const RETENTION = { codesDays: 30, sessionsDays: 90, auditMonths: 24 };

export async function runRetention(db: Pick<Db, 'verificationToken' | 'refreshToken' | 'auditLog'>, now = Date.now()) {
  const days = (n: number) => new Date(now - n * 864e5);
  const codeCut = days(RETENTION.codesDays), sessCut = days(RETENTION.sessionsDays);
  const auditCut = new Date(now); auditCut.setMonth(auditCut.getMonth() - RETENTION.auditMonths);
  const [codes, sessions, audit] = await Promise.all([
    db.verificationToken.deleteMany({ where: { OR: [{ expiresAt: { lt: codeCut } }, { usedAt: { lt: codeCut } }] } }),
    db.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: sessCut } }, { revokedAt: { lt: sessCut } }] } }),
    db.auditLog.deleteMany({ where: { createdAt: { lt: auditCut } } }),
  ]);
  return { codes: codes.count, sessions: sessions.count, audit: audit.count };
}
