import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { AuditQuery, auditWhere, decodeCursor, encodeCursor, pragueMidnight } from './audit-query';

describe('filtry auditního logu', () => {
  it('půlnoc v Praze zohlední zimní i letní čas', () => {
    assert.equal(pragueMidnight('2026-01-15')?.toISOString(), '2026-01-14T23:00:00.000Z');
    assert.equal(pragueMidnight('2026-07-15')?.toISOString(), '2026-07-14T22:00:00.000Z');
    assert.equal(pragueMidnight('2026-03-29')?.toISOString(), '2026-03-28T23:00:00.000Z');
  });
  it('neplatné datum se ignoruje', () => {
    assert.equal(pragueMidnight('2026-02-30'), null);
    assert.equal(pragueMidnight('včera'), null);
  });
  it('kurzor se zakóduje a dekóduje beze ztráty', () => {
    const d = new Date('2026-11-26T10:00:00.123Z');
    assert.deepEqual(decodeCursor(encodeCursor(d, 'abc')), { createdAt: d, id: 'abc' });
    assert.equal(decodeCursor('nesmysl'), null);
    assert.equal(decodeCursor(undefined), null);
  });
  it('prázdné filtry = bez omezení, výchozí limit 50', () => {
    const q = AuditQuery.parse({ action: '', actor: '', targetId: '' });
    assert.deepEqual(auditWhere(q), {});
    assert.equal(q.limit, 50);
    assert.equal(AuditQuery.parse({ limit: '9999' }).limit, 50);
  });
  it('akce podle prefixu, cíl, kdo a období včetně celého dne „do“', () => {
    const w = auditWhere(AuditQuery.parse({ action: 'listing', targetType: 'listing', targetId: 'L1', actor: 'jana', from: '2026-11-01', to: '2026-11-26' }));
    const and = w.AND as Record<string, unknown>[];
    assert.deepEqual(and[0], { action: { startsWith: 'listing' } });
    assert.deepEqual(and[1], { targetType: { equals: 'listing', mode: 'insensitive' } });
    assert.deepEqual(and[2], { targetId: 'L1' });
    assert.ok('OR' in and[3]);
    assert.deepEqual(and[4], { createdAt: { gte: new Date('2026-10-31T23:00:00.000Z'), lt: new Date('2026-11-26T23:00:00.000Z') } });
  });
  it('kurzor vybere starší záznamy (při shodném čase podle id)', () => {
    const d = new Date('2026-11-26T10:00:00Z');
    const w = auditWhere(AuditQuery.parse({ cursor: encodeCursor(d, 'm') }));
    assert.deepEqual((w.AND as unknown[])[0], { OR: [{ createdAt: { lt: d } }, { createdAt: d, id: { lt: 'm' } }] });
  });
});
