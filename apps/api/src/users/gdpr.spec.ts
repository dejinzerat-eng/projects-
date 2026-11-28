import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { anonymizeOps, buildExport, EXPORT_USER_SELECT, noticesWhere, runRetention, stripSecrets, userFileUrls } from './gdpr';

describe('GDPR export', () => {
  it('vybírá jen informaci o hesle, nikoli tajné hodnoty do výstupu', () => {
    assert.ok(!('tokenHash' in EXPORT_USER_SELECT) && !('codeHash' in EXPORT_USER_SELECT));
    assert.deepEqual(stripSecrets({ a: 1, passwordHash: 'x', list: [{ tokenHash: 'y', ok: true }], d: new Date(0) }), { a: 1, list: [{ ok: true }], d: new Date(0) });
  });

  it('obsahuje všechny části a rozliší odeslané a přijaté zprávy', async () => {
    const asked: string[] = [];
    const user = { id: 'u1', email: 'a@b.cz', name: 'Jana', createdAt: new Date(0), passwordHash: 'hash', googleId: null, appleId: null, isBusiness: true, companyName: 'Firma', companyId: '27082440', companyAddress: 'Praha', vatId: null, companyVerifiedAt: new Date(0), showPhone: true, showEmail: null };
    const conv = { id: 'c1', buyerId: 'u1', listing: { id: 'l1', title: 'Kolo' }, buyer: { id: 'u1', name: 'Jana' }, seller: { id: 'u2', name: 'Petr' },
      messages: [{ id: 'm1', senderId: 'u1', body: 'Dobrý den' }, { id: 'm2', senderId: 'u2', body: 'Ahoj' }] };
    const selects: Record<string, unknown> = {};
    const db = new Proxy({}, { get: (_, table: string) => ({
      findUnique: async (a: { select?: unknown }) => { selects[table] = a.select; return table === 'user' ? user : table === 'messagePreference' ? { emailOnMessage: false, updatedAt: new Date(0) } : null; },
      findMany: async (a: { select?: unknown }) => { asked.push(table); selects[table] ??= a.select; return table === 'conversation' ? [conv] : []; },
      count: async () => 3,
    }) });
    const out = await buildExport(db as never, 'u1');
    assert.ok(out);
    for (const t of ['listing', 'listingImage', 'favorite', 'followSeller', 'savedSearch', 'conversation', 'notification', 'report', 'review', 'block', 'refreshToken', 'verificationToken', 'auditLog',
      'messageAttachment', 'userRestriction', 'illegalContentNotice', 'moderationAppeal']) assert.ok(asked.includes(t), t);
    assert.equal(out.consents.emailOnNewMessage, false);
    assert.deepEqual(out.messageSettings, { emailOnMessage: false, updatedAt: new Date(0) });
    for (const k of ['messagePhotos', 'illegalContentNotices', 'moderationAppeals', 'accountRestrictions']) assert.ok(k in out, k);
    // Žádné identity členů týmu
    for (const t of ['userRestriction', 'illegalContentNotice', 'moderationAppeal']) assert.ok(!JSON.stringify(selects[t]).match(/decidedById|liftedById/), t);
    assert.equal(JSON.stringify(out).includes('hash'), false);
    assert.equal(out.account.hasPassword, true);
    assert.equal(out.company.companyId, '27082440');
    assert.equal(out.consents.showPhoneOnListings, true);
    assert.equal(out.consents.showEmailOnListings, false);
    assert.equal(out.conversations[0].role, 'kupující');
    assert.deepEqual(out.conversations[0].messages.map((m) => m.direction), ['odeslaná', 'přijatá']);
    assert.deepEqual(out.messageCounts, { sent: 1, received: 1 });
    assert.equal(out.followersCount, 3);
    assert.deepEqual(out.moderationOfYourAccount, []);
  });

  it('oznámení podle e-mailu jen u ověřeného e-mailu', () => {
    assert.deepEqual(noticesWhere('u1', 'a@b.cz', false), { OR: [{ reporterUserId: 'u1' }] });
    assert.deepEqual(noticesWhere('u1', 'a@b.cz', true).OR[1], { reporterEmail: { equals: 'a@b.cz', mode: 'insensitive' } });
  });

  it('smazání účtu pokryje všechny tabulky s osobními údaji', () => {
    const ops: { table: string; op: string; args: { where: unknown; data?: Record<string, unknown> } }[] = [];
    const db = new Proxy({}, { get: (_, table: string) => new Proxy({}, { get: (__, op: string) => (args: never) => { ops.push({ table, op, args }); return { table, op }; } }) });
    const res = anonymizeOps(db as never, { id: 'u1', email: 'a@b.cz', emailVerifiedAt: new Date(0) });
    assert.equal(res.length, ops.length);
    const by = (t: string) => ops.filter((o) => o.table === t);
    for (const t of ['messageAttachment', 'messagePreference', 'userRestriction', 'favorite', 'savedSearch', 'notification', 'block', 'verificationToken', 'listingImage']) assert.equal(by(t)[0]?.op, 'deleteMany', t);
    assert.deepEqual(by('illegalContentNotice')[0].args.data, { reporterName: null, reporterEmail: null, reporterUserId: null });
    assert.equal(JSON.stringify(by('illegalContentNotice')[0].args.where).includes('a@b.cz'), true);
    assert.equal(by('moderationAppeal')[0].op, 'updateMany');
    const u = by('user')[0].args.data!;
    assert.equal(u.status, 'BLOCKED');
    for (const k of ['phone', 'avatarUrl', 'bio', 'passwordHash', 'lastActiveAt', 'companyId']) assert.equal(u[k], null, k);
  });

  it('soubory ke smazání: profilová fotka, fotky ve zprávách a nepřiřazené nahrávky (bez duplicit)', async () => {
    const db = {
      user: { findUnique: async () => ({ avatarUrl: '/uploads/avatars/a.webp' }) },
      messageAttachment: { findMany: async () => [{ url: '/uploads/messages/c/1.webp' }] },
      message: { findMany: async () => [{ imageUrl: '/uploads/messages/c/1.webp' }, { imageUrl: '/uploads/messages/c/2.webp' }] },
      listingImage: { findMany: async () => [{ url: '/uploads/listings/x.webp', thumbUrl: '/uploads/listings/x_t.webp' }] },
    };
    assert.deepEqual(await userFileUrls(db as never, 'u1'), ['/uploads/avatars/a.webp', '/uploads/messages/c/1.webp', '/uploads/messages/c/2.webp', '/uploads/listings/x.webp', '/uploads/listings/x_t.webp']);
  });

  it('retence maže jen staré záznamy', async () => {
    const where: Record<string, unknown> = {};
    const t = (name: string) => ({ deleteMany: async (a: { where: unknown }) => { where[name] = a.where; return { count: 1 }; } });
    const now = Date.parse('2026-11-25T00:00:00Z');
    const r = await runRetention({ verificationToken: t('codes'), refreshToken: t('sessions'), auditLog: t('audit') } as never, now);
    assert.deepEqual(r, { codes: 1, sessions: 1, audit: 1 });
    assert.deepEqual(where.audit, { createdAt: { lt: new Date('2024-11-25T00:00:00Z') } });
    assert.deepEqual((where.sessions as { OR: unknown[] }).OR[0], { expiresAt: { lt: new Date(now - 90 * 864e5) } });
  });
});
