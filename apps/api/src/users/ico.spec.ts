import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { formatAresAddress, isValidIco, lookupAres, normalizeIco, parseAresSubject } from './ico';

describe('isValidIco', () => {
  it('přijme skutečná IČO', () => {
    for (const ico of ['27082440', '26168685', '00006947', '12345679', '6947']) assert.ok(isValidIco(ico), ico);
  });
  it('odmítne chybnou kontrolní číslici a nesmysly', () => {
    for (const ico of ['27082441', '12345678', '00000000', 'abcdefgh', '123456789', '']) assert.equal(isValidIco(ico), false, ico);
  });
  it('doplní úvodní nuly', () => assert.equal(normalizeIco('6947'), '00006947'));
});

const ALZA = { ico: '27082440', obchodniJmeno: 'Alza.cz a.s.', dic: 'CZ27082440', sidlo: { textovaAdresa: 'Jankovcova 1522/53, Holešovice, 17000 Praha 7' } };

describe('ARES', () => {
  it('vytáhne obchodní jméno, sídlo a DIČ', () => {
    assert.deepEqual(parseAresSubject(ALZA), { status: 'found', name: 'Alza.cz a.s.', address: 'Jankovcova 1522/53, Holešovice, 17000 Praha 7', vatId: 'CZ27082440' });
  });
  it('zaniklý subjekt', () => assert.deepEqual(parseAresSubject({ ...ALZA, datumZaniku: '2020-01-01' }), { status: 'ceased' }));
  it('složí adresu, když chybí textovaAdresa', () => {
    assert.equal(formatAresAddress({ nazevUlice: 'Jankovcova', cisloDomovni: 1522, cisloOrientacni: 53, psc: 17000, nazevObce: 'Praha' }), 'Jankovcova 1522/53, 170 00 Praha');
  });
  it('rozliší nenalezeno, chybu a výpadek', async () => {
    const res = (status: number, body: unknown = {}) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    assert.equal((await lookupAres('27082440', res(200, ALZA))).status, 'found');
    assert.equal((await lookupAres('27082440', res(404, { kod: 'NENALEZENO' }))).status, 'not_found');
    assert.equal((await lookupAres('27082440', res(503))).status, 'error');
    const down = (async () => { throw new Error('ENOTFOUND'); }) as unknown as typeof fetch;
    assert.equal((await lookupAres('27082440', down)).status, 'error');
  });
  it('volá správnou adresu', async () => {
    let url = '';
    const spy = (async (u: string) => { url = u; return new Response(JSON.stringify(ALZA)); }) as unknown as typeof fetch;
    await lookupAres('6947', spy);
    assert.equal(url, 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/00006947');
  });
});
