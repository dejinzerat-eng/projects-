import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { storageTarget } from './storage.service';

const none = { blob: false, s3PublicUrl: '' };

describe('mazání souborů z úložiště', () => {
  it('lokální disk jen pod /uploads/ a bez únikových cest', () => {
    assert.deepEqual(storageTarget('/uploads/messages/c1/abc.webp', none), { kind: 'local', key: 'messages/c1/abc.webp' });
    assert.equal(storageTarget('/uploads/../.env', none), null);
    assert.equal(storageTarget('/uploads/a/./b.webp', none), null);
    assert.equal(storageTarget('/etc/passwd', none), null);
    assert.equal(storageTarget('', none), null);
    assert.equal(storageTarget(null, none), null);
  });
  it('S3 jen pod veřejnou URL bucketu', () => {
    const env = { blob: false, s3PublicUrl: 'https://cdn.dejinzerat.cz/media/' };
    assert.deepEqual(storageTarget('https://cdn.dejinzerat.cz/media/listings/2026-11/x.webp', env), { kind: 's3', key: 'listings/2026-11/x.webp' });
    assert.equal(storageTarget('https://cdn.dejinzerat.cz/jine/x.webp', env), null);
    assert.equal(storageTarget('https://evil.cz/media/x.webp', env), null);
    assert.equal(storageTarget('http://cdn.dejinzerat.cz/media/x.webp', env), null);
    assert.equal(storageTarget('https://cdn.dejinzerat.cz/media/x.webp?x=1', env), null);
  });
  it('Vercel Blob jen s tokenem a jen na doméně Blobu', () => {
    const url = 'https://abcd1234.public.blob.vercel-storage.com/messages/c1/abc.webp';
    assert.deepEqual(storageTarget(url, { blob: true, s3PublicUrl: '' }), { kind: 'blob', url });
    assert.equal(storageTarget(url, none), null);
    assert.equal(storageTarget('https://lh3.googleusercontent.com/a/photo.jpg', { blob: true, s3PublicUrl: '' }), null);
  });
});
