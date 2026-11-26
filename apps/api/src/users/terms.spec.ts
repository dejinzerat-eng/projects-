import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { termsOutdated } from './terms';

describe('termsOutdated', () => {
  it('účet bez souhlasu musí podmínky potvrdit', () => {
    assert.equal(termsOutdated(null, '2026-11-25'), true);
    assert.equal(termsOutdated(undefined, '2026-11-25'), true);
    assert.equal(termsOutdated('', '2026-11-25'), true);
  });
  it('starší verze je zastaralá, stejná ani novější ne', () => {
    assert.equal(termsOutdated('2026-01-01', '2026-11-25'), true);
    assert.equal(termsOutdated('2026-11-25', '2026-11-25'), false);
    assert.equal(termsOutdated('2026-12-01', '2026-11-25'), false);
  });
  it('verze v jiném tvaru se porovnávají na shodu', () => {
    assert.equal(termsOutdated('v1', 'v2'), true);
    assert.equal(termsOutdated('v2', 'v2'), false);
  });
});
