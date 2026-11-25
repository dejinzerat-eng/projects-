import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { nextExpiry, nextStatus } from './lifecycle';

describe('nextStatus', () => {
  const base = { premoderation: false, score: 0 };
  it('koncept zůstane konceptem, zveřejnění podle moderace', () => {
    assert.equal(nextStatus({ ...base, publish: false }), 'DRAFT');
    assert.equal(nextStatus({ ...base, publish: true }), 'ACTIVE');
    assert.equal(nextStatus({ ...base, publish: true, score: 60 }), 'PENDING');
    assert.equal(nextStatus({ ...base, publish: true, premoderation: true }), 'PENDING');
    assert.equal(nextStatus({ ...base, current: 'DRAFT', publish: false }), 'DRAFT');
    assert.equal(nextStatus({ ...base, current: 'DRAFT', publish: true }), 'ACTIVE');
  });
  it('oprava zamítnutého inzerátu ho znovu posoudí', () => {
    assert.equal(nextStatus({ ...base, current: 'REJECTED', publish: true, premoderation: true }), 'PENDING');
    assert.equal(nextStatus({ ...base, current: 'REJECTED', publish: true }), 'ACTIVE');
    assert.equal(nextStatus({ ...base, current: 'REJECTED', publish: true, score: 80 }), 'PENDING');
  });
  it('rizikovou úpravu viditelného inzerátu stáhne ke schválení', () => {
    assert.equal(nextStatus({ ...base, current: 'ACTIVE', publish: true, score: 50 }), 'PENDING');
    assert.equal(nextStatus({ ...base, current: 'RESERVED', publish: true }), 'RESERVED');
    assert.equal(nextStatus({ ...base, current: 'EXPIRED', publish: true }), 'EXPIRED');
    assert.equal(nextStatus({ ...base, current: 'PENDING', publish: true }), 'PENDING');
  });
});

describe('nextExpiry', () => {
  const now = new Date('2026-11-25T12:00:00Z');
  const in30 = new Date(now.getTime() + 30 * 864e5);
  it('koncept platnost nemá, zveřejněním začne běžet celá', () => {
    assert.equal(nextExpiry({ after: 'DRAFT', expiresAt: null, now, days: 30 }), null);
    assert.deepEqual(nextExpiry({ after: 'ACTIVE', expiresAt: null, now, days: 30 }), in30);
    assert.deepEqual(nextExpiry({ before: 'DRAFT', after: 'PENDING', expiresAt: new Date('2026-01-01'), now, days: 30 }), in30);
  });
  it('úprava aktivního inzerátu platnost neprodlouží, prošlou nebo zamítnutou obnoví', () => {
    const later = new Date('2026-12-10T00:00:00Z');
    assert.deepEqual(nextExpiry({ before: 'ACTIVE', after: 'ACTIVE', expiresAt: later, now, days: 30 }), later);
    assert.deepEqual(nextExpiry({ before: 'REJECTED', after: 'PENDING', expiresAt: later, now, days: 30 }), in30);
    assert.deepEqual(nextExpiry({ before: 'ACTIVE', after: 'PENDING', expiresAt: new Date('2026-11-01'), now, days: 30 }), in30);
  });
});
