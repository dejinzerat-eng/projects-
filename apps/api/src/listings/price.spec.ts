import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { DEFAULT_EUR_RATE, priceInCzk } from './price';

describe('cena v Kč (priceCzk)', () => {
  it('Kč zůstanou, bez ceny je null', () => {
    assert.equal(priceInCzk(1500, 'CZK', 25), 1500);
    assert.equal(priceInCzk(null, 'EUR', 25), null);
    assert.equal(priceInCzk(undefined, 'CZK', 25), null);
    assert.equal(priceInCzk(0, 'EUR', 25), 0);
  });

  it('eura přepočte kurzem a zaokrouhlí', () => {
    assert.equal(priceInCzk(100, 'EUR', 25), 2500);
    assert.equal(priceInCzk(3, 'EUR', 24.5), 74);
  });

  it('neplatný kurz nahradí výchozím a výsledek se vejde do Int', () => {
    assert.equal(priceInCzk(10, 'EUR', 0), 10 * DEFAULT_EUR_RATE);
    assert.equal(priceInCzk(10, 'EUR', Number.NaN), 10 * DEFAULT_EUR_RATE);
    assert.equal(priceInCzk(2_000_000_000, 'EUR', 25), 2_147_483_647);
  });

  it('100 EUR je při řazení dražší než 2 000 Kč', () => {
    assert.ok(priceInCzk(100, 'EUR', 25)! > priceInCzk(2000, 'CZK', 25)!);
  });
});
