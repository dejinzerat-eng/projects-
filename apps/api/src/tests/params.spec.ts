import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { cleanParams, effectiveFilters, type FilterDef } from '@dej/shared';

const defs: FilterDef[] = [
  { key: 'brand', label: 'Značka', type: 'select', options: ['Škoda', 'BMW'] },
  { key: 'year', label: 'Rok výroby', type: 'range', min: 1950, max: 2026 },
  { key: 'size', label: 'Velikost', type: 'multiselect', options: ['S', 'M', 'L'] },
  { key: 'warranty', label: 'Záruka', type: 'boolean' },
];

describe('cleanParams', () => {
  it('převezme platné hodnoty a zahodí neznámé klíče', () => {
    const r = cleanParams(defs, { brand: 'Škoda', year: '2018', size: ['M', 'L'], warranty: true, hack: 'x' });
    assert.equal(r.error, null);
    assert.deepEqual(r.values, { brand: 'Škoda', year: 2018, size: ['M', 'L'], warranty: true });
  });
  it('v přísném režimu odmítne hodnotu mimo nabídku nebo rozsah', () => {
    assert.match(cleanParams(defs, { brand: 'Tatra' }).error ?? '', /Značka/);
    assert.match(cleanParams(defs, { year: 1800 }).error ?? '', /nejméně 1950/);
    assert.match(cleanParams(defs, { year: 'loni' }).error ?? '', /číslo/);
    assert.match(cleanParams(defs, { size: ['XXL'] }).error ?? '', /Velikost/);
  });
  it('u konceptu neplatné hodnoty jen vynechá', () => {
    const r = cleanParams(defs, { brand: 'Tatra', year: 2010 }, false);
    assert.equal(r.error, null);
    assert.deepEqual(r.values, { year: 2010 });
  });
});

describe('effectiveFilters', () => {
  it('spojí filtry rodiče a podkategorie (podkategorie přepíše stejný klíč)', () => {
    const f = effectiveFilters('nova', [defs[0], defs[1]], 'pod', [{ key: 'year', label: 'Rok', type: 'range' }, { key: 'color', label: 'Barva', type: 'select', options: ['Bílá'] }]);
    assert.deepEqual(f.map((x) => x.key), ['brand', 'year', 'color']);
    assert.equal(f.find((x) => x.key === 'year')?.label, 'Rok');
  });
  it('podkategorie bez parametrů ve výchozím stromu nezdědí parametry rodiče', () => {
    assert.deepEqual(effectiveFilters('auto-moto', [defs[0]], 'nahradni-dily', []), []);
  });
  it('ignoruje poškozené definice z databáze', () => {
    assert.deepEqual(effectiveFilters('x', 'nesmysl', 'y', [{ key: 'a' }, null, { key: 'b', label: 'B', type: 'boolean' }]).map((x) => x.key), ['b']);
  });
});
