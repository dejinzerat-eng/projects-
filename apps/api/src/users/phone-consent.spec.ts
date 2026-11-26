import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { keepsPhoneConsent } from './phone-consent';

describe('souhlas se zobrazením telefonu', () => {
  it('stejné číslo (i v jiném zápisu) souhlas zachová', () => {
    assert.equal(keepsPhoneConsent('+420777123456', '+420777123456'), true);
    assert.equal(keepsPhoneConsent('+420 777 123 456', '+420777123456'), true);
    assert.equal(keepsPhoneConsent('777123456', '+420777123456'), true);
  });
  it('nové číslo souhlas ruší', () => {
    assert.equal(keepsPhoneConsent('+420777123456', '+420777123457'), false);
    assert.equal(keepsPhoneConsent('+421777123456', '+420777123456'), false);
    assert.equal(keepsPhoneConsent(null, '+420777123456'), false);
  });
});
