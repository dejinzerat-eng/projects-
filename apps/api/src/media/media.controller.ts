import { BadRequestException, Controller, HttpException, HttpStatus, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import sharp from 'sharp';
import { Auth, AuthUser, CurrentUser } from '../common/auth.guard';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { GUEST_COOKIE, GUEST_COOKIE_DAYS, GUEST_MAX_IMAGES_PER_DAY, guestOwner, validGuestToken } from '../listings/guest';
import { imageHash, isHeif } from './image-hash';
import { StorageService } from './storage.service';

const MAX = 15 * 1024 * 1024;

@Controller('media')
export class MediaController {
  constructor(private storage: StorageService, private prisma: PrismaService, private redis: RedisService) {}

  /**
   * Vlastník fotky: přihlášený uživatel, nebo – při vkládání inzerátu bez registrace – tento prohlížeč
   * (náhodný token v cookie, v databázi jen jeho otisk). Fotky se k účtu převedou po odeslání inzerátu.
   */
  private async owner(u: AuthUser | undefined, req: Request, res: Response) {
    if (u) return u.id;
    let token = req.cookies?.[GUEST_COOKIE] as unknown;
    if (!validGuestToken(token)) {
      token = randomBytes(32).toString('base64url');
      res.cookie(GUEST_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge: GUEST_COOKIE_DAYS * 864e5, path: '/' });
    }
    const owner = guestOwner(token as string);
    if ((await this.redis.incr(`guestimg:${owner}`, 86_400)) > GUEST_MAX_IMAGES_PER_DAY || (await this.redis.incr(`guestimg:ip:${req.ip}`, 86_400)) > GUEST_MAX_IMAGES_PER_DAY * 3) {
      throw new HttpException('Bez přihlášení lze dnes nahrát už jen málo fotek. Přihlaste se, nebo to zkuste zítra.', HttpStatus.TOO_MANY_REQUESTS);
    }
    return owner;
  }

  /** Nahrání fotky: odstraní EXIF (GPS!), zmenší na 1600 px a vytvoří náhled 480 px ve WebP. */
  @Auth('optional')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX } }))
  async image(@UploadedFile() file: Express.Multer.File, @CurrentUser() u: AuthUser | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
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
    const ownerId = await this.owner(u, req, res);
    const id = randomBytes(10).toString('hex');
    const prefix = `listings/${new Date().toISOString().slice(0, 7)}/${id}`;
    const [large, thumb, phash] = await Promise.all([
      img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
      img.clone().resize({ width: 640, height: 480, fit: 'cover' }).webp({ quality: 76 }).toBuffer(),
      imageHash(img).catch(() => null),
    ]);
    const [url, thumbUrl] = await Promise.all([this.storage.put(`${prefix}.webp`, large.data, 'image/webp'), this.storage.put(`${prefix}_t.webp`, thumb, 'image/webp')]);
    const rec = await this.prisma.listingImage.create({ data: { ownerId, url, thumbUrl, width: large.info.width, height: large.info.height, phash } });
    return { id: rec.id, url, thumbUrl, width: rec.width, height: rec.height };
  }
}
