import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ListingStatus, Prisma } from '@prisma/client';
import { buildSearchText, slugify } from '@dej/shared';
import { createHash } from 'crypto';
import sharp from 'sharp';
import { ListingPolicyService } from '../admin/listing-policy.service';
import { AuthService } from '../auth/auth.service';
import { config } from '../common/config';
import { PrismaService } from '../common/prisma.service';
import { contentHash } from '../listings/duplicates';
import { REVIEW_SCORE } from '../listings/lifecycle';
import { assessListingDetailed } from '../listings/moderation';
import { imageHash } from '../media/image-hash';
import { StorageService } from '../media/storage.service';
import { SearchService } from '../search/search.service';
import {
  cleanDescription, cleanEmail, cleanPrice, cleanTitle, imageNames, joinLegacyHash, LEGACY_CATEGORIES, type LegacyListing, type LegacyUser,
  legacyUserId, mapCategory, mapLocation, mapOfferType, normalizePhone, sellerName, sourceHash, splitLegacyHash, writtenHash,
} from './legacy-map';
import { LegacySource } from './legacy-source';

/** Jedna dávka importu smí běžet nejvýše tolik (funkce na Vercelu má limit 60 s). */
const BATCH_BUDGET_MS = 35_000;
const VISIBLE: ListingStatus[] = ['ACTIVE', 'PENDING', 'RESERVED'];

export type ScanAction = 'new' | 'changed' | 'unchanged';
export interface ScanItem {
  id: string; title: string; oldCategory: string; newCategory: string; price: number | null; place: string; images: number;
  action: ScanAction; status: ListingStatus; risk: string[]; listingId?: string;
}
export type ImportResult = 'created' | 'updated' | 'unchanged' | 'edited' | 'gone' | 'error';

/** Import inzerátů ze starého webu www.dejinzerat.cz. Opakovatelný: podle legacyId nic nezdvojí. */
@Injectable()
export class LegacyImportService {
  private log = new Logger('LegacyImport');

  constructor(
    private prisma: PrismaService, private storage: StorageService, private search: SearchService,
    private policy: ListingPolicyService, private auth: AuthService,
  ) {}

  /** Zdroj dat – v testech se nahradí falešným starým webem. */
  source = () => new LegacySource();

  private async categoryIds() {
    const cats = await this.prisma.category.findMany({ select: { id: true, slug: true, name: true, parentId: true, parent: { select: { slug: true, name: true } } } });
    const map = new Map<string, { id: string; label: string }>();
    for (const c of cats) if (c.parent) map.set(`${c.parent.slug}/${c.slug}`, { id: c.id, label: `${c.parent.name} › ${c.name}` });
    return map;
  }

  private target(l: LegacyListing, cats: Map<string, { id: string; label: string }>) {
    const [parent, sub] = mapCategory(l);
    const hit = cats.get(`${parent}/${sub}`) ?? cats.get('ostatni/ruzne');
    if (!hit) throw new Error(`V databázi chybí kategorie ${parent}/${sub} (spusťte seed).`);
    return { ...hit, parentSlug: parent };
  }

  private mapped(l: LegacyListing, cats: Map<string, { id: string; label: string }>) {
    const title = cleanTitle(l.InzeratName) || 'Inzerát';
    const description = cleanDescription(l);
    const price = cleanPrice(l.Price);
    const cat = this.target(l, cats);
    const loc = mapLocation(l.Location, `${title}\n${description}`);
    const risk = assessListingDetailed({ title, description, price, categorySlug: cat.parentSlug });
    const reasons = risk.reasons.length ? [...risk.reasons.slice(0, -1), `${risk.reasons.at(-1)}${risk.labels.length ? ` (${risk.labels.join(', ')})` : ''}`] : [];
    return { title, description, price, cat, loc, risk: { score: risk.score, reasons, labels: risk.labels }, offerType: mapOfferType(l) };
  }

  /** Náhled: co je na starém webu a co se s tím při importu stane. Nic nezapisuje. */
  async scan() {
    const src = this.source();
    const { listings, complete, pageCount } = await src.allListings();
    const cats = await this.categoryIds();
    const existing = await this.prisma.listing.findMany({ where: { legacyId: { not: null } }, select: { id: true, legacyId: true, legacyHash: true, status: true, title: true } });
    const byLegacy = new Map(existing.map((e) => [e.legacyId!, e]));
    const items: ScanItem[] = listings.filter((l) => l.Active !== false && l.Approved !== false).map((l) => {
      const m = this.mapped(l, cats);
      const ex = byLegacy.get(l.InzeratId);
      const action: ScanAction = !ex ? 'new' : splitLegacyHash(ex.legacyHash).source === sourceHash(l) ? 'unchanged' : 'changed';
      const status: ListingStatus = ex ? ex.status : m.risk.score >= REVIEW_SCORE ? 'PENDING' : 'ACTIVE';
      return {
        id: l.InzeratId, title: m.title, oldCategory: LEGACY_CATEGORIES[l.CategoryId]?.name ?? `#${l.CategoryId}`, newCategory: m.cat.label,
        price: m.price, place: m.loc.city, images: imageNames(l.ImgsPath).length, action, status, risk: m.risk.reasons, listingId: ex?.id,
      };
    });
    const seen = new Set(listings.map((l) => l.InzeratId));
    const missing = existing.filter((e) => !seen.has(e.legacyId!) && VISIBLE.includes(e.status)).map((e) => ({ id: e.legacyId!, listingId: e.id, title: e.title, status: e.status }));
    return {
      source: src.base, complete, pageCount, total: items.length,
      sellers: new Set(listings.map((l) => l.UserId)).size,
      images: items.reduce((n, i) => n + i.images, 0),
      counts: {
        new: items.filter((i) => i.action === 'new').length, changed: items.filter((i) => i.action === 'changed').length,
        unchanged: items.filter((i) => i.action === 'unchanged').length, review: items.filter((i) => i.action === 'new' && i.status === 'PENDING').length,
      },
      items, missing: complete ? missing : [],
    };
  }

  /** Dávka importu: zpracuje inzeráty v pořadí, dokud nevyprší časový limit. Vrátí výsledky a zbývající ID. */
  async run(ids: string[], actorId: string, budgetMs = BATCH_BUDGET_MS) {
    const started = Date.now();
    const src = this.source();
    const cats = await this.categoryIds();
    const results: { id: string; result: ImportResult; message?: string; listingId?: string; status?: ListingStatus; warnings?: string[] }[] = [];
    let i = 0;
    for (; i < ids.length; i++) {
      if (i > 0 && Date.now() - started > budgetMs) break;
      const id = ids[i];
      try { results.push({ id, ...(await this.importOne(src, id, cats)) }); }
      catch (e) {
        this.log.warn(`Inzerát ${id}: ${(e as Error).message}`);
        results.push({ id, result: 'error', message: (e as Error).message });
      }
    }
    await this.prisma.auditLog.create({ data: { actorId, action: 'legacy.import', targetType: 'system', targetId: 'legacy-import', meta: { processed: results.length, created: results.filter((r) => r.result === 'created').length, updated: results.filter((r) => r.result === 'updated').length, errors: results.filter((r) => r.result === 'error').length } } });
    return { results, remaining: ids.slice(i) };
  }

  /** Prodejce: podle legacyId, jinak podle e-mailu (už registrovaný účet se jen propojí), jinak nový účet bez hesla. */
  private async seller(u: LegacyUser) {
    const legacyId = legacyUserId(u.UserId);
    const email = cleanEmail(u.Email);
    const name = sellerName(u);
    const phone = normalizePhone(u.TelNumber);
    const known = await this.prisma.user.findUnique({ where: { legacyId } });
    if (known) {
      // Dokud si prodejce účet nepřevzal (nemá heslo ani Google/Apple), držíme údaje podle starého webu
      if (!known.passwordHash && !known.googleId && !known.appleId) {
        const emailFree = email && email !== known.email && !(await this.prisma.user.findUnique({ where: { email } }));
        await this.prisma.user.update({ where: { id: known.id }, data: { name, phone, ...(emailFree ? { email } : {}), ...(u.Banned ? { status: 'BLOCKED' } : {}) } });
      }
      return known.id;
    }
    if (email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        if (!byEmail.legacyId) await this.prisma.user.update({ where: { id: byEmail.id }, data: { legacyId } });
        return byEmail.id;
      }
    }
    const created = await this.prisma.user.create({
      data: {
        email: email ?? `stary-web-${u.UserId}@dejinzerat.invalid`, name, phone, legacyId, status: u.Banned ? 'BLOCKED' : 'ACTIVE',
        // Údaje převzaté ze starého webu – e-mail ani telefon nejsou ověřené, telefon se proto u inzerátů nezobrazí
        emailVerifiedAt: null, phoneVerifiedAt: null, showPhone: false,
      },
    });
    return created.id;
  }

  private async importOne(src: LegacySource, id: string, cats: Map<string, { id: string; label: string }>): Promise<{ result: ImportResult; message?: string; listingId?: string; status?: ListingStatus; warnings?: string[] }> {
    const l = await src.listing(id);
    if (!l) return { result: 'gone', message: 'Inzerát už na starém webu není.' };
    if (l.Active === false || l.Approved === false) return { result: 'gone', message: 'Inzerát není na starém webu zveřejněný.' };
    const userId = await this.seller(l.user ?? { UserId: l.UserId });
    const m = this.mapped(l, cats);
    const now = new Date();
    const days = await this.policy.listingDays();
    const fresh = new Date(now.getTime() + days * 864e5);
    const srcHash = sourceHash(l);
    const written = writtenHash({ title: m.title, description: m.description, price: m.price, categoryId: m.cat.id });
    const created = l.DateCreated ? new Date(l.DateCreated) : now;
    const createdAt = Number.isNaN(created.getTime()) || created > now ? now : created;
    const existing = await this.prisma.listing.findUnique({ where: { legacyId: id }, include: { user: { select: { passwordHash: true, googleId: true, appleId: true } }, images: { select: { id: true, url: true, thumbUrl: true } } } });

    const base = {
      slug: slugify(m.title) || 'inzerat', title: m.title, description: m.description, price: m.price, priceCzk: m.price, priceNegotiable: false, currency: 'CZK',
      categoryId: m.cat.id, offerType: m.offerType, city: m.loc.city, region: m.loc.region, zip: null, lat: m.loc.lat, lng: m.loc.lng,
      searchText: buildSearchText({ title: m.title, description: m.description, attributes: {}, city: m.loc.city }),
      spamScore: m.risk.score, riskReasons: m.risk.reasons as Prisma.InputJsonValue, contentHash: contentHash(m.title, m.description),
      legacyHash: joinLegacyHash(srcHash, written),
    };

    if (!existing) {
      const status: ListingStatus = m.risk.score >= REVIEW_SCORE ? 'PENDING' : 'ACTIVE';
      const listing = await this.prisma.listing.create({ data: { ...base, userId, status, attributes: {}, legacyId: id, createdAt, publishedAt: createdAt, expiresAt: fresh } });
      const warnings = await this.importImages(src, listing.id, userId, id, imageNames(l.ImgsPath));
      await this.search.index(listing.id);
      return { result: 'created', listingId: listing.id, status, warnings };
    }

    const claimed = !!(existing.user.passwordHash || existing.user.googleId || existing.user.appleId);
    // Prodejce, který si účet převzal, spravuje inzerát sám – platnost ani stav mu import nemění
    const refresh: { expiresAt?: Date; expiryNotifiedAt?: null; status?: ListingStatus } = !claimed && ['ACTIVE', 'EXPIRED'].includes(existing.status)
      ? { expiresAt: existing.expiresAt && existing.expiresAt > fresh ? existing.expiresAt : fresh, expiryNotifiedAt: null, ...(existing.status === 'EXPIRED' ? { status: (m.risk.score >= REVIEW_SCORE ? 'PENDING' : 'ACTIVE') as ListingStatus } : {}) }
      : {};
    const prev = splitLegacyHash(existing.legacyHash);
    if (prev.source === srcHash) {
      if (Object.keys(refresh).length) await this.prisma.listing.update({ where: { id: existing.id }, data: refresh });
      if (refresh.status) await this.search.index(existing.id);
      return { result: 'unchanged', listingId: existing.id, status: refresh.status ?? existing.status };
    }
    const current = writtenHash({ title: existing.title, description: existing.description, price: existing.price, categoryId: existing.categoryId });
    if (claimed || current !== prev.written) return { result: 'edited', listingId: existing.id, status: existing.status, message: 'Inzerát byl mezitím upraven v novém systému – změny ze starého webu se nepřepíšou.' };

    let status = (refresh.status ?? existing.status) as ListingStatus;
    if (['ACTIVE', 'RESERVED'].includes(status) && m.risk.score >= REVIEW_SCORE) status = 'PENDING';
    await this.prisma.listing.update({ where: { id: existing.id }, data: { ...base, ...refresh, status, userId } });
    let warnings: string[] = [];
    const names = imageNames(l.ImgsPath);
    const oldNames = (await this.prisma.listingImage.count({ where: { listingId: existing.id } })) === names.length && existing.images.every((img) => names.some((n) => img.url.includes(`/${shortHash(n)}`)));
    if (!oldNames) {
      await this.prisma.listingImage.deleteMany({ where: { listingId: existing.id } });
      await this.storage.deleteMany(existing.images.flatMap((img) => [img.url, img.thumbUrl]));
      warnings = await this.importImages(src, existing.id, userId, id, names);
    }
    await this.search.index(existing.id);
    return { result: 'updated', listingId: existing.id, status, warnings };
  }

  /** Stáhne fotky, zmenší je stejně jako běžné nahrání (1600 px + náhled) a uloží do našeho úložiště. */
  private async importImages(src: LegacySource, listingId: string, ownerId: string, legacyId: string, names: string[]) {
    const warnings: string[] = [];
    const rows: Prisma.ListingImageCreateManyInput[] = [];
    for (let i = 0; i < names.length; i += 3) {
      await Promise.all(names.slice(i, i + 3).map(async (name, k) => {
        const position = i + k;
        try {
          const buf = await src.image(name);
          const img = sharp(buf, { failOn: 'error' }).rotate();
          const [large, thumb, phash] = await Promise.all([
            img.clone().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true }),
            img.clone().resize({ width: 640, height: 480, fit: 'cover' }).webp({ quality: 76 }).toBuffer(),
            imageHash(img).catch(() => null),
          ]);
          const prefix = `legacy/${legacyId}/${shortHash(name)}`;
          const [url, thumbUrl] = await Promise.all([this.storage.put(`${prefix}.webp`, large.data, 'image/webp'), this.storage.put(`${prefix}_t.webp`, thumb, 'image/webp')]);
          rows.push({ listingId, ownerId, url, thumbUrl, width: large.info.width, height: large.info.height, position, phash });
        } catch (e) { warnings.push(`Fotka ${position + 1}: ${(e as Error).message}`); }
      }));
    }
    if (rows.length) await this.prisma.listingImage.createMany({ data: rows.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)) });
    return warnings;
  }

  /** Inzeráty, které na starém webu už nejsou: skončí jako „vypršelé“ (prodejce je může po převzetí účtu obnovit). */
  async archiveMissing(legacyIds: string[], actorId: string) {
    const rows = await this.prisma.listing.findMany({ where: { legacyId: { in: legacyIds }, status: { in: VISIBLE } }, select: { id: true } });
    await this.prisma.listing.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status: 'EXPIRED' } });
    for (const r of rows) await this.search.index(r.id);
    await this.prisma.auditLog.create({ data: { actorId, action: 'legacy.archive_missing', targetType: 'system', targetId: 'legacy-import', meta: { count: rows.length } } });
    return { archived: rows.length };
  }

  private inviteWhere(): Prisma.UserWhereInput {
    return { legacyId: { not: null }, legacyInvitedAt: null, passwordHash: null, googleId: null, appleId: null, status: { not: 'BLOCKED' }, NOT: { email: { endsWith: '.invalid' } } };
  }

  /** Stav rozesílání přístupů prodejcům ze starého webu. */
  async inviteStatus() {
    const [legacy, pending, invited, claimed] = await Promise.all([
      this.prisma.user.count({ where: { legacyId: { not: null } } }),
      this.prisma.user.count({ where: this.inviteWhere() }),
      this.prisma.user.count({ where: { legacyId: { not: null }, legacyInvitedAt: { not: null } } }),
      this.prisma.user.count({ where: { legacyId: { not: null }, OR: [{ passwordHash: { not: null } }, { googleId: { not: null } }, { appleId: { not: null } }] } }),
    ]);
    const withoutEmail = await this.prisma.user.count({ where: { legacyId: { not: null }, email: { endsWith: '.invalid' } } });
    return { legacy, pending, invited, claimed, withoutEmail, mailReady: !!config.resendKey, webOrigin: config.webOrigin };
  }

  /** Rozešle pozvánky s odkazem na nastavení hesla (jen těm, kdo ji ještě nedostali a účet nepřevzali). */
  async sendInvites(actorId: string, budgetMs = BATCH_BUDGET_MS) {
    if (!config.resendKey) throw new BadRequestException('Odesílání e-mailů zatím není nastavené (chybí klíč Resend). Pozvánky rozešlete až po připojení domény a e-mailu.');
    const started = Date.now();
    let sent = 0;
    for (;;) {
      if (Date.now() - started > budgetMs) break;
      const batch = await this.prisma.user.findMany({ where: this.inviteWhere(), select: { id: true, email: true, name: true, _count: { select: { listings: { where: { status: { in: VISIBLE } } } } } }, take: 10, orderBy: { createdAt: 'asc' } });
      if (!batch.length) break;
      for (const u of batch) {
        await this.auth.sendLegacyInvite(u, u._count.listings);
        await this.prisma.user.update({ where: { id: u.id }, data: { legacyInvitedAt: new Date() } });
        sent++;
      }
    }
    await this.prisma.auditLog.create({ data: { actorId, action: 'legacy.invite', targetType: 'system', targetId: 'legacy-import', meta: { sent } } });
    return { sent, remaining: await this.prisma.user.count({ where: this.inviteWhere() }) };
  }

  /** Nová adresa inzerátu podle ID ze starého webu (přesměrování /produkt?id=…). */
  async resolve(legacyId: string) {
    return this.prisma.listing.findUnique({ where: { legacyId }, select: { id: true, slug: true } });
  }
}

const shortHash = (name: string) => createHash('sha1').update(name).digest('hex').slice(0, 12);
