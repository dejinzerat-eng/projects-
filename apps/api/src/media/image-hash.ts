import type sharp from 'sharp';
import { dHashFromPixels } from '../listings/duplicates';

/** Percepční otisk fotky (dHash): odolá zmenšení, přeuložení i mírné úpravě jasu. */
export async function imageHash(img: sharp.Sharp): Promise<bigint> {
  const px = await img.clone().removeAlpha().greyscale().resize(9, 8, { fit: 'fill', kernel: 'cubic' }).toColourspace('b-w').raw().toBuffer();
  return dHashFromPixels(px);
}

/** HEIC/HEIF podle obsahu (ISO BMFF „ftyp“ se značkou heic, heix, mif1 …), ne podle přípony. */
export function isHeif(buf: Buffer): boolean {
  if (buf.length < 12 || buf.toString('latin1', 4, 8) !== 'ftyp') return false;
  const brand = buf.toString('latin1', 8, 12);
  return ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand);
}
