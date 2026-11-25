import { strict as assert } from 'node:assert';
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, it } from 'node:test';
import { isTrustedWrite } from './csrf';
import { describeDevice } from './device';
import { escapeHtml } from './html';
import { checkIdTokenClaims, verifyRs256 } from './jwt';
import { attemptsLeft, lockedMessage } from './lockout';
import { packOAuthState, safeBack, sameState, unpackOAuthState } from './oauth-state';

const allowed = new Set(['https://dejinzerat.cz']);
const w = (over: Partial<Parameters<typeof isTrustedWrite>[0]>) => isTrustedWrite({ method: 'POST', path: '/auth/login', hasCookie: true, hasBearer: false, ...over }, allowed);

describe('CSRF', () => {
  it('pustí čtecí požadavky bez hlaviček (i cron GET /jobs/tick)', () => {
    assert.equal(w({ method: 'GET', path: '/jobs/tick' }), true);
    assert.equal(w({ method: 'HEAD' }), true);
  });
  it('pustí zápis z našeho Originu a odmítne cizí', () => {
    assert.equal(w({ origin: 'https://dejinzerat.cz' }), true);
    assert.equal(w({ origin: 'https://evil.example' }), false);
    assert.equal(w({ origin: 'null' }), false);
  });
  it('bez Originu rozhoduje Referer ze stejné adresy', () => {
    assert.equal(w({ referer: 'https://dejinzerat.cz/muj-ucet/nastaveni' }), true);
    assert.equal(w({ referer: 'https://dejinzerat.cz.evil.example/' }), false);
    assert.equal(w({ referer: 'nesmysl' }), false);
  });
  it('odmítne zápis bez Originu i Refereru', () => {
    assert.equal(w({}), false);
    assert.equal(w({ method: 'DELETE', path: '/me' }), false);
    assert.equal(w({ hasCookie: false }), false);
  });
  it('pustí klienta s Bearer tokenem bez cookie, ale ne s cookie', () => {
    assert.equal(w({ hasCookie: false, hasBearer: true }), true);
    assert.equal(w({ hasCookie: true, hasBearer: true }), false);
  });
  it('výjimka jen pro callback Apple', () => {
    assert.equal(w({ path: '/auth/apple/callback' }), true);
    assert.equal(w({ path: '/auth/apple/callback/' }), true);
    assert.equal(w({ path: '/auth/google/callback' }), false);
  });
});

describe('návratová adresa a OAuth state', () => {
  it('safeBack pustí jen cesty na našem webu', () => {
    assert.equal(safeBack('/muj-ucet/nastaveni?x=1'), '/muj-ucet/nastaveni?x=1');
    for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/a\nb', '', null, undefined]) assert.equal(safeBack(bad as string), '/', String(bad));
  });
  it('zabalí a rozbalí state, nonce a zpet', () => {
    const v = packOAuthState({ state: 'abc', nonce: 'n1', back: '/inzerat/1/kolo?a=b.c' });
    assert.deepEqual(unpackOAuthState(v), { state: 'abc', nonce: 'n1', back: '/inzerat/1/kolo?a=b.c' });
    assert.equal(unpackOAuthState(packOAuthState({ state: 's', nonce: 'n', back: '//evil.example' }))!.back, '/');
    assert.equal(unpackOAuthState('jen-state'), null);
    assert.equal(unpackOAuthState(undefined), null);
  });
  it('sameState porovnává přesně', () => {
    assert.equal(sameState('abc', 'abc'), true);
    assert.equal(sameState('abc', 'abd'), false);
    assert.equal(sameState('', ''), false);
    assert.equal(sameState(undefined, 'abc'), false);
  });
});

describe('id_token (Apple)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'K1' };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const make = (claims: object, kid = 'K1', key = privateKey) => {
    const input = `${b64({ alg: 'RS256', kid })}.${b64(claims)}`;
    return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
  };
  const now = Math.floor(Date.now() / 1000);
  const good = { iss: 'https://appleid.apple.com', aud: 'cz.dejinzerat.web', sub: '001.abc', exp: now + 600, iat: now, nonce: 'N', email: 'a@b.cz', email_verified: 'true' };
  const opts = { iss: 'https://appleid.apple.com', aud: 'cz.dejinzerat.web', nonce: 'N' };

  it('ověří podpis a claims', () => {
    const c = checkIdTokenClaims(verifyRs256(make(good), [jwk]), opts);
    assert.equal(c.sub, '001.abc');
  });
  it('odmítne cizí podpis a neznámý klíč', () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
    assert.throws(() => verifyRs256(make(good, 'K1', other), [jwk]), /podpis/);
    assert.throws(() => verifyRs256(make(good, 'K2'), [jwk]), /Neznámý klíč/);
  });
  it('odmítne vypršelý token, jiný nonce, vydavatele a adresáta', () => {
    assert.throws(() => checkIdTokenClaims({ ...good, exp: now - 3600 }, opts), /vypršela/);
    assert.throws(() => checkIdTokenClaims({ ...good, exp: undefined }, opts), /vypršela/);
    assert.throws(() => checkIdTokenClaims({ ...good, nonce: 'X' }, opts), /nonce/);
    assert.throws(() => checkIdTokenClaims({ ...good, nonce: undefined }, opts), /nonce/);
    assert.throws(() => checkIdTokenClaims({ ...good, iss: 'https://evil' }, opts), /vydal/);
    assert.throws(() => checkIdTokenClaims({ ...good, aud: 'jina.app' }, opts), /jiné aplikaci/);
  });
  it('odmítne token s alg none', () => {
    const t = `${b64({ alg: 'none', kid: 'K1' })}.${b64(good)}.`;
    assert.throws(() => verifyRs256(t, [jwk]), /algoritmus/);
  });
});

describe('texty a zařízení', () => {
  it('lockedMessage skloňuje minuty', () => {
    const now = new Date('2026-11-25T10:00:00Z');
    assert.match(lockedMessage(new Date(now.getTime() + 60_000), now), /za 1 minutu/);
    assert.match(lockedMessage(new Date(now.getTime() + 3 * 60_000), now), /za 3 minuty/);
    assert.match(lockedMessage(new Date(now.getTime() + 14.2 * 60_000), now), /za 15 minut/);
  });
  it('attemptsLeft skloňuje pokusy', () => {
    assert.equal(attemptsLeft(1), 'Zbývá 1 pokus');
    assert.equal(attemptsLeft(3), 'Zbývají 3 pokusy');
    assert.equal(attemptsLeft(5), 'Zbývá 5 pokusů');
  });
  it('describeDevice pozná běžné prohlížeče', () => {
    assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'), 'Chrome · Windows');
    assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'), 'Safari · iPhone');
    assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0'), 'Edge · Windows');
    assert.equal(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:133.0) Gecko/20100101 Firefox/133.0'), 'Firefox · Mac');
    assert.equal(describeDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'), 'Chrome · Android');
    assert.equal(describeDevice(undefined), 'Neznámé zařízení');
  });
  it('escapeHtml zneškodní značky ve jménu', () => {
    assert.equal(escapeHtml('<a href="x">Jan</a> & \'spol\''), '&lt;a href=&quot;x&quot;&gt;Jan&lt;/a&gt; &amp; &#39;spol&#39;');
  });
});
