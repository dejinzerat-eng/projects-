import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { buildExport, EXPORT_USER_SELECT, runRetention, stripSecrets } from './gdpr';

describe('GDPR export', () => {
  it('vybírá jen informaci o hesle, nikoli tajné hodnoty do výstupu', () => {
    assert.ok(!('tokenHash' in EXPORT_USER_SELECT) && !('codeHash' in EXPORT_USER_SELECT));
    assert.deepEqual(stripSecrets({ a: 1, passwordHash: 'x', list: [{ tokenHash: 'y', ok: true }], d: new Date(0) }), { a: 1, list: [{ ok: true }], d: new Date(0) });
  });

  it('obsahuje všechny části a rozliší odeslané a přijaté zprávy', async () => {
    const asked: string[] = [];
    const user = { id: 'u1', email: 'a@b.cz', name: 'Jana', createdAt: new Date(0), passwordHash: 'hash', googleId: null, appleId: null, isBusiness: true, companyName: 'Firma', companyId: '27082440', companyAddress: 'Praha', vatId: null, companyVerifiedAt: new Date(0), showPhone: true };
    const conv = { id: 'c1', buyerId: 'u1', listing: { id: 'l1', title: 'Kolo' }, buyer: { id: 'u1', name: 'Jana' }, seller: { id: 'u2', name: 'Petr' },
      messages: [{ id: 'm1', senderId: 'u1', body: 'Dobrý den' }, { id: 'm2', senderId: 'u2', body: 'Ahoj' }] };
    const db = new Proxy({}, { get: (_, table: string) => ({
      findUnique: async () => user,
      findMany: async () => { asked.push(table); return table === 'conversation' ? [conv] : []; },
      count: async () => 3,
    }) });
    const out = await buildExport(db as never, 'u1');
    assert.ok(out);
    for (const t of ['listing', 'listingImage', 'favorite', 'followSeller', 'savedSearch', 'conversation', 'notification', 'report', 'review', 'block', 'refreshToken', 'verificationToken', 'auditLog']) assert.ok(asked.includes(t), t);
    assert.equal(JSON.stringify(out).includes('hash'), false);
    assert.equal(out.account.hasPassword, true);
    assert.equal(out.company.companyId, '27082440');
    assert.equal(out.consents.showPhoneOnListings, true);
    assert.equal(out.conversations[0].role, 'kupující');
    assert.deepEqual(out.conversations[0].messages.map((m) => m.direction), ['odeslaná', 'přijatá']);
    assert.deepEqual(out.messageCounts, { sent: 1, received: 1 });
    assert.equal(out.followersCount, 3);
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
