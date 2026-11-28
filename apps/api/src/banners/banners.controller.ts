import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Put, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { audit, diff } from '../admin/audit';
import { AuthUser, CurrentUser } from '../common/auth.guard';
import { Can } from '../common/permissions';
import { PrismaService } from '../common/prisma.service';
import { ZodPipe } from '../common/zod';
import { StorageService } from '../media/storage.service';
import { BannerFields, MAX_BANNER_BYTES, PUBLIC_BANNERS } from './banners.logic';

/** Veřejná část: bannery pro úvodní stránku a počítání kliknutí. */
@Controller('banners')
export class BannersController {
  constructor(private prisma: PrismaService) {}

  /** Aktivní bannery v pořadí (nejvýše 3). Prázdné pole = řada se na webu nezobrazí. */
  @Get()
  list() {
    return this.prisma.banner.findMany({
      where: { active: true }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], take: PUBLIC_BANNERS,
      select: { id: true, imageUrl: true, linkUrl: true, alt: true },
    });
  }

  /** Kliknutí na banner (posílá prohlížeč na pozadí přes sendBeacon; odkaz vede přímo na cíl). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/click')
  async click(@Param('id') id: string) {
    await this.prisma.banner.updateMany({ where: { id, active: true }, data: { clicks: { increment: 1 } } });
    return { ok: true };
  }
}

/** Správa bannerů v administraci: nahrání obrázku, odkaz, popis, zapnutí/vypnutí, pořadí. */
@Controller('admin/banners')
export class BannersAdminController {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  /** Obrázek banneru: kontrola, že jde opravdu o obrázek, zmenšení na max. 1200 px a převod na WebP (animace GIF zůstane). */
  private async saveImage(file: Express.Multer.File | undefined) {
    if (!file) return null;
    if (file.size > MAX_BANNER_BYTES) throw new BadRequestException('Obrázek je příliš velký (max. 4 MB).');
    let out: Buffer;
    try {
      const meta = await sharp(file.buffer).metadata();
      if (!['jpeg', 'png', 'webp', 'gif', 'avif'].includes(meta.format ?? '')) throw new Error(meta.format);
      const animated = (meta.pages ?? 1) > 1;
      let img = sharp(file.buffer, { animated, failOn: 'error' });
      if (!animated) img = img.rotate();
      out = await img.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch {
      throw new BadRequestException('Soubor není platný obrázek. Podporujeme JPG, PNG, WebP a GIF.');
    }
    return this.storage.put(`banners/${new Date().toISOString().slice(0, 7)}/${randomBytes(10).toString('hex')}.webp`, out, 'image/webp');
  }

  @Can('banners.manage')
  @Get()
  list() {
    return this.prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] });
  }

  /** Nový banner – formulář s obrázkem (multipart: file, alt, linkUrl, active). Zařadí se na konec. */
  @Can('banners.manage')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BANNER_BYTES } }))
  async create(@CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Body(new ZodPipe(BannerFields)) dto: z.infer<typeof BannerFields>) {
    if (!file) throw new BadRequestException('Vyberte obrázek banneru.');
    const imageUrl = (await this.saveImage(file))!;
    const last = await this.prisma.banner.aggregate({ _max: { position: true } });
    const b = await this.prisma.banner.create({ data: { imageUrl, alt: dto.alt, linkUrl: dto.linkUrl ?? null, active: dto.active ?? true, position: (last._max.position ?? -1) + 1 } });
    await audit(this.prisma, u, 'banner.create', 'banner', b.id, { alt: b.alt, linkUrl: b.linkUrl, active: b.active });
    return b;
  }

  /** Úprava: text, odkaz, zapnutí/vypnutí, případně nový obrázek (starý soubor se smaže). */
  @Can('banners.manage')
  @Put(':id')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_BANNER_BYTES } }))
  async update(@Param('id') id: string, @CurrentUser() u: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Body(new ZodPipe(BannerFields.partial())) dto: Partial<z.infer<typeof BannerFields>>) {
    const before = await this.prisma.banner.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Banner neexistuje.');
    const imageUrl = await this.saveImage(file);
    const data = { ...(dto.alt !== undefined ? { alt: dto.alt } : {}), ...(dto.linkUrl !== undefined ? { linkUrl: dto.linkUrl } : {}), ...(dto.active !== undefined ? { active: dto.active } : {}), ...(imageUrl ? { imageUrl } : {}) };
    const b = await this.prisma.banner.update({ where: { id }, data });
    if (imageUrl) await this.storage.delete(before.imageUrl).catch(() => false);
    await audit(this.prisma, u, 'banner.update', 'banner', id, diff(before, data));
    return b;
  }

  /** Posun v pořadí o jedno místo (prohození s vedlejším bannerem). */
  @Can('banners.manage')
  @Post(':id/move')
  async move(@Param('id') id: string, @CurrentUser() u: AuthUser, @Body(new ZodPipe(z.object({ direction: z.enum(['up', 'down']) }))) dto: { direction: 'up' | 'down' }) {
    const all = await this.prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true } });
    const i = all.findIndex((b) => b.id === id);
    if (i < 0) throw new NotFoundException('Banner neexistuje.');
    const j = dto.direction === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= all.length) return { ok: true };
    [all[i], all[j]] = [all[j], all[i]];
    // Přečíslování 0..n zároveň srovná případné shodné pozice
    await this.prisma.$transaction(all.map((b, pos) => this.prisma.banner.update({ where: { id: b.id }, data: { position: pos } })));
    await audit(this.prisma, u, 'banner.move', 'banner', id, { direction: dto.direction });
    return { ok: true };
  }

  @Can('banners.manage')
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() u: AuthUser) {
    const b = await this.prisma.banner.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Banner neexistuje.');
    await this.prisma.banner.delete({ where: { id } });
    await this.storage.delete(b.imageUrl).catch(() => false);
    await audit(this.prisma, u, 'banner.delete', 'banner', id, { alt: b.alt, linkUrl: b.linkUrl, clicks: b.clicks });
    return { ok: true };
  }
}
