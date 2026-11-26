import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { SearchParams, toSearchString } from '@dej/shared';
import { config } from '../common/config';
import { MailerService } from '../common/mailer.service';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { StorageService } from '../media/storage.service';
import { cleanupUnsentAttachments } from '../messages/attachments-cleanup';
import { promotionExpired } from '../search/search-query';
import { SearchService } from '../search/search.service';
import { runRetention } from '../users/gdpr';

/**
 * Pravidelné úlohy (každých 5 minut, zámek v Redisu → běží jen na jedné instanci):
 * - upozornění na brzy končící inzeráty (3 dny předem) a jejich expirace,
 * - konec topování / zvýraznění (vymaže prošlá data a přeindexuje, aby inzerát nezůstal první),
 * - chytrá upozornění na nové inzeráty odpovídající uloženému hledání,
 * - jednou za hodinu úklid neodeslaných fotek ve zprávách (starších 24 h), jednou denně retence dat.
 */
@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private log = new Logger('Jobs');
  private timer?: NodeJS.Timeout;

  constructor(private prisma: PrismaService, private redis: RedisService, private search: SearchService, private mail: MailerService, private storage: StorageService) {}

  onApplicationBootstrap() {
    if (process.env.DISABLE_JOBS === '1') return;
    this.timer = setInterval(() => void this.tick(), 5 * 60_000);
    setTimeout(() => void this.tick(), 15_000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async tick() {
    if (!(await this.redis.lock('jobs:tick', 240))) return;
    try { await this.search.backfillSearchText(); await this.expiry(); await this.promotionExpiry(); await this.savedSearchAlerts(); } catch (e) { this.log.error((e as Error).stack); }
    if (await this.redis.lock('jobs:attachments', 3600)) await this.unsentAttachments().catch((e) => this.log.error((e as Error).stack));
    if (await this.redis.lock('jobs:retention', 86_400)) await runRetention(this.prisma).catch((e) => this.log.error((e as Error).stack));
  }

  /** Neodeslané fotky ve zprávách starší 24 h (na Vercelu běží cron jen jednou denně → až 5 dávek po 500) */
  async unsentAttachments() {
    let records = 0, files = 0;
    for (let i = 0; i < 5; i++) {
      const r = await cleanupUnsentAttachments(this.prisma, this.storage);
      records += r.records; files += r.files;
      if (r.records < 500) break;
    }
    if (records) this.log.log(`Smazáno ${records} neodeslaných fotek ve zprávách (${files} souborů)`);
  }

  async expiry() {
    const soon = await this.prisma.listing.findMany({ where: { status: 'ACTIVE', expiresAt: { lte: new Date(Date.now() + 3 * 864e5) }, expiryNotifiedAt: null }, include: { user: true }, take: 500 });
    for (const l of soon) {
      await this.prisma.notification.create({ data: { userId: l.userId, type: 'expiry', title: `Inzerát „${l.title}“ brzy skončí`, body: 'Prodlužte ho jedním kliknutím, ať ho kupující dál vidí.', link: '/muj-ucet/inzeraty' } });
      await this.mail.send(l.user.email, `Váš inzerát „${l.title}“ za 3 dny skončí`, `<p>Prodloužit ho můžete zdarma v <a href="${config.webOrigin}/muj-ucet/inzeraty">Mých inzerátech</a>.</p>`);
      await this.prisma.listing.update({ where: { id: l.id }, data: { expiryNotifiedAt: new Date() } });
    }
    const expired = await this.prisma.listing.findMany({ where: { status: { in: ['ACTIVE', 'RESERVED'] }, expiresAt: { lte: new Date() } }, select: { id: true }, take: 1000 });
    if (expired.length) {
      await this.prisma.listing.updateMany({ where: { id: { in: expired.map((e) => e.id) } }, data: { status: 'EXPIRED' } });
      for (const e of expired) await this.search.index(e.id);
      this.log.log(`Expirováno ${expired.length} inzerátů`);
    }
  }

  /** Prošlé topování a zvýraznění: smazat datum platnosti a přeindexovat (pořadí v Meilisearch se počítá při indexaci). */
  async promotionExpiry(now = new Date()) {
    const rows = await this.prisma.listing.findMany({
      where: { OR: [{ topUntil: { lte: now } }, { highlightedUntil: { lte: now } }] },
      select: { id: true, topUntil: true, highlightedUntil: true }, take: 1000,
    });
    for (const l of rows) {
      await this.prisma.listing.update({ where: { id: l.id }, data: promotionExpired(l, now) });
      await this.search.index(l.id);
    }
    if (rows.length) this.log.log(`Skončila propagace inzerátů: ${rows.length}`);
    return rows.length;
  }

  async savedSearchAlerts() {
    const searches = await this.prisma.savedSearch.findMany({ where: { notify: true, lastCheckedAt: { lte: new Date(Date.now() - 4 * 60_000) } }, include: { user: true }, take: 2000 });
    for (const s of searches) {
      const since = s.lastCheckedAt;
      const r = await this.search.search(s.query as SearchParams, { publishedAfter: since, limit: 10 });
      await this.prisma.savedSearch.update({ where: { id: s.id }, data: { lastCheckedAt: new Date() } });
      const fresh = r.hits.filter((h) => h.createdAt > since.getTime());
      if (!fresh.length) continue;
      const link = `/hledat?${toSearchString(s.query as SearchParams)}`;
      await this.prisma.notification.create({ data: { userId: s.userId, type: 'saved-search', title: `${fresh.length}× nový inzerát: ${s.name}`, body: fresh.slice(0, 3).map((h) => h.title).join(' · '), link } });
      await this.mail.send(s.user.email, `Nové inzeráty pro „${s.name}“`, `<p>Našli jsme nové nabídky:</p><ul>${fresh.map((h) => `<li><a href="${config.webOrigin}/inzerat/${h.id}/${h.slug}">${h.title}</a> – ${h.price ?? 'dohodou'} Kč, ${h.city}</li>`).join('')}</ul><p><a href="${config.webOrigin}${link}">Zobrazit vše</a></p>`);
    }
  }
}
