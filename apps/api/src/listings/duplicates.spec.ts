import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { imageHash, isHeif } from '../media/image-hash';
import { contentHash, hamming, isWeakHash, normalizeText, PHASH_MAX_DISTANCE } from './duplicates';

describe('normalizeText / contentHash', () => {
  it('ignoruje velikost písmen, diakritiku, interpunkci a mezery', () => {
    assert.equal(normalizeText('  Škoda Octavia,  1.9 TDI!!  '), 'skoda octavia 1 9 tdi');
    assert.equal(contentHash('Prodám kolo', 'Zachovalé, málo jeté.'), contentHash('PRODAM  KOLO', 'zachovale malo jete'));
    assert.notEqual(contentHash('Prodám kolo', 'Zachovalé'), contentHash('Prodám kolo', 'Poškozené'));
  });
});

describe('hamming', () => {
  it('počítá rozdílné bity i u záporných (podepsaných) čísel', () => {
    assert.equal(hamming(0n, 0n), 0);
    assert.equal(hamming(0b1011n, 0b0001n), 2);
    assert.equal(hamming(-1n, 0n), 64);
    assert.ok(isWeakHash(0n) && isWeakHash(-1n) && !isWeakHash(0x5a5a5a5a5a5a5a5an));
  });
});

/** Testovací „fotka“: barevné přechody a kruh, aby měl obrázek strukturu */
async function photo(seed: number, w = 800, h = 600) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#${(seed * 2654435761 % 0xffffff).toString(16).padStart(6, '0')}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${(seed * 97) % w}" cy="${(seed * 53) % h}" r="${80 + (seed % 5) * 30}" fill="#123"/><rect x="${(seed * 31) % w}" y="${h / 2}" width="200" height="90" fill="#e33"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
}

describe('imageHash (dHash)', () => {
  it('stejná fotka po zmenšení a přeuložení má blízký otisk, jiná fotka vzdálený', async () => {
    const a = await photo(7);
    const aSmall = await sharp(a).resize(400).webp({ quality: 60 }).toBuffer();
    const b = await photo(3);
    const [ha, has, hb] = await Promise.all([imageHash(sharp(a)), imageHash(sharp(aSmall)), imageHash(sharp(b))]);
    assert.ok(hamming(ha, has) <= PHASH_MAX_DISTANCE, `zmenšená: ${hamming(ha, has)}`);
    assert.ok(hamming(ha, hb) > PHASH_MAX_DISTANCE * 2, `jiná: ${hamming(ha, hb)}`);
    assert.ok(ha >= -(2n ** 63n) && ha < 2n ** 63n);
  });
});

describe('isHeif', () => {
  it('pozná HEIC podle hlavičky ftyp', () => {
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    assert.equal(isHeif(heic), true);
    assert.equal(isHeif(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), false);
  });
});
