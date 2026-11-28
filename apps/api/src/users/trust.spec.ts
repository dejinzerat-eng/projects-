import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { trustScore } from './trust';

const now = Date.parse('2026-11-25T00:00:00Z');
const base = { emailVerified: false, phoneVerified: false, isBusiness: false, companyVerified: false, companyId: null, createdAt: new Date(now), ratingCount: 0, ratingAvg: null, sold: 0 };

describe('trustScore', () => {
  it('nový neověřený účet má 0', () => assert.equal(trustScore(base, now).score, 0));
  it('ověření e-mailu a telefonu', () => assert.equal(trustScore({ ...base, emailVerified: true, phoneVerified: true }, now).score, 40));
  it('IČO dává body i odznak jen po ověření v ARES', () => {
    const unverified = trustScore({ ...base, isBusiness: true, companyId: '27082440' }, now);
    assert.equal(unverified.score, 0);
    assert.deepEqual(unverified.breakdown.at(-1), { label: 'IČO zatím neověřeno v ARES', ok: false });
    const verified = trustScore({ ...base, isBusiness: true, companyId: '27082440', companyVerified: true }, now);
    assert.equal(verified.score, 10);
    assert.deepEqual(verified.breakdown.at(-1), { label: 'Firma s IČO 27082440 (ověřeno v ARES)', ok: true });
  });
  it('nikdy nepřesáhne 100', () => {
    const r = trustScore({ ...base, emailVerified: true, phoneVerified: true, isBusiness: true, companyId: '1', companyVerified: true, createdAt: new Date(now - 5 * 365 * 864e5), ratingCount: 50, ratingAvg: 5, sold: 50 }, now);
    assert.equal(r.score, 100);
  });
  it('bez SMS ověření řádek o telefonu chybí, ověřený telefon zůstane', () => {
    assert.equal(trustScore(base, now, { phoneVerifiable: false }).breakdown.some((b) => b.label === 'Ověřený telefon'), false);
    assert.equal(trustScore({ ...base, phoneVerified: true }, now, { phoneVerifiable: false }).breakdown.some((b) => b.label === 'Ověřený telefon' && b.ok), true);
    assert.equal(trustScore(base, now).breakdown.some((b) => b.label === 'Ověřený telefon'), true);
  });
});
