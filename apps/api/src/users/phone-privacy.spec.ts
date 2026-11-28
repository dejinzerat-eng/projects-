import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { canRevealEmail, canRevealPhone, sellerSharesEmail, sellerSharesPhone } from './phone-privacy';

const ok = { phone: '+420777123456', phoneVerifiedAt: new Date(), showPhone: true, status: 'ACTIVE' };

describe('telefon prodejce', () => {
  it('ukáže se jen výslovně zveřejněný', () => {
    assert.equal(sellerSharesPhone(ok), true);
    assert.equal(sellerSharesPhone({ ...ok, showPhone: false }), false);
    assert.equal(sellerSharesPhone({ ...ok, phone: null }), false);
    assert.equal(sellerSharesPhone({ ...ok, status: 'BLOCKED' }), false);
  });
  it('neověřené číslo se ukáže, dokud ověření nevyžadujeme', () => {
    assert.equal(sellerSharesPhone({ ...ok, phoneVerifiedAt: null }, false), true);
    assert.equal(sellerSharesPhone({ ...ok, phoneVerifiedAt: null }, true), false);
    assert.equal(sellerSharesPhone(ok, true), true);
  });
  it('jen u aktivních inzerátů a bez blokace', () => {
    assert.equal(canRevealPhone('ACTIVE', ok, false), true);
    assert.equal(canRevealPhone('RESERVED', ok, false), true);
    for (const s of ['SOLD', 'EXPIRED', 'PENDING', 'REJECTED', 'DELETED', 'DRAFT']) assert.equal(canRevealPhone(s, ok, false), false, s);
    assert.equal(canRevealPhone('ACTIVE', ok, true), false);
  });
  it('e-mail jen s výslovným souhlasem, ověřený a skutečný', () => {
    const e = { email: 'jana@seznam.cz', emailVerifiedAt: new Date(), showEmail: true as boolean | null, status: 'ACTIVE' };
    assert.equal(sellerSharesEmail(e), true);
    assert.equal(sellerSharesEmail({ ...e, showEmail: null }), false);
    assert.equal(sellerSharesEmail({ ...e, showEmail: false }), false);
    assert.equal(sellerSharesEmail({ ...e, emailVerifiedAt: null }), false);
    assert.equal(sellerSharesEmail({ ...e, email: 'stary-web-5@dejinzerat.invalid' }), false);
    assert.equal(sellerSharesEmail({ ...e, status: 'BLOCKED' }), false);
    assert.equal(canRevealEmail('ACTIVE', e, false), true);
    assert.equal(canRevealEmail('SOLD', e, false), false);
    assert.equal(canRevealEmail('ACTIVE', e, true), false);
  });
});
