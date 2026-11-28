import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { ContactPhoneFields, planPhoneUpdate } from './phone-contact';

const none = { phone: null, phoneVerifiedAt: null, showPhone: false };
const has = { phone: '+420777123456', phoneVerifiedAt: null, showPhone: true };

describe('telefon z formuláře inzerátu', () => {
  it('nové číslo se uloží neověřené s volbou zobrazení', () => {
    assert.deepEqual(planPhoneUpdate(none, '777 123 456', true), { phone: '+420777123456', phoneVerifiedAt: null, showPhone: true });
    assert.deepEqual(planPhoneUpdate(none, '777123456', false), { phone: '+420777123456', phoneVerifiedAt: null, showPhone: false });
  });
  it('stejné číslo mění jen viditelnost, ověření zůstává', () => {
    assert.equal(planPhoneUpdate(has, '+420 777 123 456', true), null);
    assert.deepEqual(planPhoneUpdate({ ...has, phoneVerifiedAt: new Date() }, '777123456', false), { showPhone: false });
  });
  it('prázdné číslo nic nemaže, jen skryje', () => {
    assert.deepEqual(planPhoneUpdate(has, '', false), { showPhone: false });
    assert.equal(planPhoneUpdate(none, undefined, false), null);
  });
  it('odkaz do cizího účtu nepřepíše existující číslo', () => {
    assert.equal(planPhoneUpdate(has, '608111222', true, true), null);
    assert.deepEqual(planPhoneUpdate(none, '608111222', true, true), { phone: '+420608111222', phoneVerifiedAt: null, showPhone: true });
  });
  it('kontrola formátu', () => {
    assert.equal(ContactPhoneFields.phone.safeParse('12345').success, false);
    assert.equal(ContactPhoneFields.phone.safeParse('').success, true);
    assert.equal(ContactPhoneFields.phone.safeParse('+421 905 123 456').success, true);
  });
});
