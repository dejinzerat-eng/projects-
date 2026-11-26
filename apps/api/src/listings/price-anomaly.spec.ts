import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { isPriceAnomaly, pickPriceStats, PRICE_ANOMALY_MIN_SAMPLE } from './price-anomaly';

const enough = PRICE_ANOMALY_MIN_SAMPLE;

describe('podezřele nízká cena', () => {
  it('cena pod 30 % mediánu je podezřelá, od 30 % už ne', () => {
    const s = { median: 20_000, sample: enough };
    assert.equal(isPriceAnomaly(3_000, s), true);
    assert.equal(isPriceAnomaly(5_999, s), true);
    assert.equal(isPriceAnomaly(6_000, s), false);
    assert.equal(isPriceAnomaly(18_000, s), false);
  });
  it('bez ceny, zdarma nebo bez mediánu se nehodnotí', () => {
    const s = { median: 20_000, sample: enough };
    assert.equal(isPriceAnomaly(null, s), false);
    assert.equal(isPriceAnomaly(0, s), false);
    assert.equal(isPriceAnomaly(100, null), false);
    assert.equal(isPriceAnomaly(100, { median: null, sample: 0 }), false);
  });
  it('medián podkategorie má přednost, při malém vzorku se použije hlavní kategorie', () => {
    const sub = { median: 10_000, sample: enough }, parent = { median: 500, sample: 200 };
    assert.equal(pickPriceStats(sub, parent), sub);
    assert.equal(pickPriceStats({ median: 10_000, sample: enough - 1 }, parent), parent);
  });
  it('málo inzerátů všude = bez srovnání', () => {
    assert.equal(pickPriceStats({ median: 10_000, sample: 2 }, { median: 9_000, sample: 3 }), null);
    assert.equal(pickPriceStats({ median: 10_000, sample: 2 }, null), null);
    assert.equal(pickPriceStats(null, null), null);
  });
});
