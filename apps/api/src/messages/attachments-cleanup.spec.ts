import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { cleanupUnsentAttachments, UNSENT_ATTACHMENT_TTL_MS } from './attachments-cleanup';

describe('úklid neodeslaných fotek ve zprávách', () => {
  it('smaže staré neodeslané záznamy a jejich soubory, ale ne fotku odeslanou mezitím', async () => {
    const now = Date.parse('2026-11-26T12:00:00Z');
    const calls: unknown[] = [];
    let removed: string[] = [];
    const db = { messageAttachment: {
      findMany: async (a: { where: { messageId?: null; createdAt?: { lt: Date }; id?: { in: string[] } } }) => {
        calls.push(a.where);
        if (a.where.createdAt) return [{ id: 'a1', url: '/uploads/messages/c/1.webp' }, { id: 'a2', url: '/uploads/messages/c/2.webp' }];
        return [{ id: 'a2' }]; // a2 byla mezitím odeslána
      },
      deleteMany: async (a: { where: unknown }) => { calls.push(a.where); return { count: 1 }; },
    } };
    const storage = { deleteMany: async (urls: string[]) => { removed = urls; return urls.length; } };
    const r = await cleanupUnsentAttachments(db as never, storage, now);
    assert.deepEqual(r, { records: 1, files: 1 });
    assert.deepEqual(removed, ['/uploads/messages/c/1.webp']);
    assert.deepEqual(calls[0], { messageId: null, createdAt: { lt: new Date(now - UNSENT_ATTACHMENT_TTL_MS) } });
    assert.deepEqual(calls[1], { id: { in: ['a1', 'a2'] }, messageId: null });
  });
  it('bez starých příloh nic nemaže', async () => {
    const db = { messageAttachment: { findMany: async () => [], deleteMany: async () => { throw new Error('nemá se volat'); } } };
    assert.deepEqual(await cleanupUnsentAttachments(db as never, { deleteMany: async () => 0 }), { records: 0, files: 0 });
  });
});
