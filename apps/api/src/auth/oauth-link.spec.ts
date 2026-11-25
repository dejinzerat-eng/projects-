import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AuthService, OAuthError } from './auth.service';

type U = { id: string; email: string; name: string; passwordHash: string | null; phone: string | null; phoneVerifiedAt: Date | null; emailVerifiedAt: Date | null; googleId: string | null; appleId: string | null; avatarUrl: string | null; status: string; failedLogins: number; lockedUntil: Date | null };

/** Minimální náhrada Prismy v paměti – jen to, co používá linkOAuth. */
function fakeDb(users: U[]) {
  const sessions = users.map((u) => ({ userId: u.id, tokenHash: `h-${u.id}`, revokedAt: null as Date | null }));
  const tokens = users.map((u) => ({ userId: u.id, usedAt: null as Date | null }));
  const audits: { actorId: string; action: string; meta: unknown }[] = [];
  const match = (u: U, w: Record<string, unknown>) => Object.entries(w).every(([k, v]) => (u as unknown as Record<string, unknown>)[k] === v);
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => users.find((u) => match(u, where)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<U> }) => { const u = users.find((x) => x.id === where.id)!; Object.assign(u, data); return u; },
      create: async ({ data }: { data: Partial<U> }) => { const u = { id: `new${users.length}`, passwordHash: null, phone: null, phoneVerifiedAt: null, googleId: null, appleId: null, avatarUrl: null, status: 'ACTIVE', failedLogins: 0, lockedUntil: null, emailVerifiedAt: null, name: '', email: '', ...data } as U; users.push(u); return u; },
    },
    refreshToken: {
      findMany: async ({ where }: { where: { userId: string } }) => sessions.filter((s) => s.userId === where.userId && !s.revokedAt),
      updateMany: async ({ where, data }: { where: { userId: string }; data: { revokedAt: Date } }) => { let n = 0; for (const s of sessions) if (s.userId === where.userId && !s.revokedAt) { s.revokedAt = data.revokedAt; n++; } return { count: n }; },
    },
    verificationToken: {
      updateMany: async ({ where, data }: { where: { userId: string }; data: { usedAt: Date } }) => { for (const t of tokens) if (t.userId === where.userId && !t.usedAt) t.usedAt = data.usedAt; return { count: 1 }; },
    },
    auditLog: { create: async ({ data }: { data: { actorId: string; action: string; meta: unknown } }) => { audits.push(data); return data; } },
  };
  const redis = { del: async () => undefined };
  const svc = new AuthService(prisma as never, {} as never, {} as never, redis as never);
  return { svc, users, sessions, tokens, audits };
}

const base = (over: Partial<U>): U => ({ id: 'u1', email: 'obet@example.cz', name: 'Obět', passwordHash: 'hash-utocnika', phone: '+420777000111', phoneVerifiedAt: new Date(), emailVerifiedAt: null, googleId: null, appleId: null, avatarUrl: null, status: 'ACTIVE', failedLogins: 0, lockedUntil: null, ...over });

for (const provider of ['google', 'apple'] as const) {
  describe(`linkOAuth (${provider})`, () => {
    it('neověřený účet se stejným e-mailem: smaže heslo a telefon, odhlásí všechna zařízení', async () => {
      const db = fakeDb([base({})]);
      const u = await db.svc.linkOAuth(provider, { sub: 'S1', email: 'Obet@Example.cz', emailVerified: true });
      assert.equal(u.id, 'u1');
      assert.equal(u.passwordHash, null);
      assert.equal(u.phone, null);
      assert.ok(u.emailVerifiedAt);
      assert.equal(provider === 'google' ? u.googleId : u.appleId, 'S1');
      assert.ok(db.sessions.every((s) => s.revokedAt), 'session útočníka musí přestat platit');
      assert.ok(db.tokens.every((t) => t.usedAt), 'rozpracované tokeny musí přestat platit');
      assert.deepEqual(db.audits.map((a) => a.action), ['auth.oauth_link']);
      assert.equal((db.audits[0].meta as { unverifiedAccountReset: boolean }).unverifiedAccountReset, true);
    });

    it('ověřený účet napáruje a heslo ani session nemění', async () => {
      const db = fakeDb([base({ emailVerifiedAt: new Date('2026-01-01') })]);
      const u = await db.svc.linkOAuth(provider, { sub: 'S1', email: 'obet@example.cz', emailVerified: true });
      assert.equal(u.passwordHash, 'hash-utocnika');
      assert.ok(db.sessions.every((s) => !s.revokedAt));
    });

    it('zablokovaný účet nepřihlásí', async () => {
      const db = fakeDb([base({ status: 'BLOCKED', emailVerifiedAt: new Date(), ...(provider === 'google' ? { googleId: 'S1' } : { appleId: 'S1' }) })]);
      await assert.rejects(db.svc.linkOAuth(provider, { sub: 'S1', email: 'obet@example.cz', emailVerified: true }), (e: unknown) => e instanceof OAuthError && e.code === 'blokovan');
    });

    it('bez ověřeného e-mailu nový účet nezaloží', async () => {
      const db = fakeDb([]);
      await assert.rejects(db.svc.linkOAuth(provider, { sub: 'S9', email: 'x@y.cz', emailVerified: false }), (e: unknown) => e instanceof OAuthError && e.code === 'email');
    });

    it('nový účet uloží souhlas s podmínkami', async () => {
      const db = fakeDb([]);
      const u = await db.svc.linkOAuth(provider, { sub: 'S9', email: 'Nova@Y.cz', emailVerified: true, name: 'Nová' }) as U & { termsAcceptedAt?: Date; termsVersion?: string };
      assert.equal(u.email, 'nova@y.cz');
      assert.ok(u.termsAcceptedAt);
      assert.ok(u.termsVersion);
    });
  });
}
