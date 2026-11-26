import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { Auth, AuthUser, CurrentUser } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { imageHash, isHeif } from './image-hash';
import { StorageService } from './storage.service';

const MAX = 15 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(private storage: StorageService, private prisma: PrismaService) {}

  /** Nahrání fotky: odstraní EXIF (GPS!), zmenší na 1600 px a vytvoří náhled 480 px ve WebP. */
  @Auth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX } }))
  async image(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser) {
    if (!file) throw new BadRequestException('Chybí soubor.');
    // Typ posílaný prohlížečem nestačí (Windows u .heic často pošle prázdný typ) – rozhoduje obsah souboru.
    const heif = isHeif(file.buffer);
    if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.mimetype) && !(heif || /^(application\/octet-stream|)$/.test(file.mimetype))) throw new BadRequestException('Podporujeme JPG, PNG, WebP a HEIC.');
    let img: sharp.Sharp;
    try {
      img = sharp(file.buffer, { failOn: 'error' }).rotate();
      const meta = await img.metadata();
      if (!['jpeg', 'png', 'webp', 'heif', 'avif'].includes(meta.format ?? '')) throw new Error(meta.format);
      // libheif bez dekodéru HEVC vrátí metadata, ale obrázek nepřečte – ověříme skutečným dekódováním
      if (heif) await img.clone().resize(8, 8).raw().toBuffer();
    } catch {
      throw new BadRequestException(heif
        ? 'Fotku ve formátu HEIC se nepodařilo převést. Zkuste ji nahrát znovu, případně ji v telefonu uložte jako JPG (Nastavení › Fotoaparát › Formáty › Nejkompatibilnější).'
        : 'Soubor není platný obrázek.');
    }
    const id = randomBytes(10).toString('hex');
    const prefix = `listings/${new Date().toISOString().slice(0, 7)}/${id}`;
    const [large, thumb, phash] = await Promise.all([
      img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
      img.clone().resize({ width: 640, height: 480, fit: 'cover' }).webp({ quality: 76 }).toBuffer(),
      imageHash(img).catch(() => null),
    ]);
    const [url, thumbUrl] = await Promise.all([this.storage.put(`${prefix}.webp`, large.data, 'image/webp'), this.storage.put(`${prefix}_t.webp`, thumb, 'image/webp')]);
    const rec = await this.prisma.listingImage.create({ data: { ownerId: u.id, url, thumbUrl, width: large.info.width, height: large.info.height, phash } });
    return { id: rec.id, url, thumbUrl, width: rec.width, height: rec.height };
  }
}
