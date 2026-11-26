import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from './settings.service';
import { TrustService } from './trust.service';

/**
 * Pravidla vkládání inzerátů řízená systémovými nastaveními (WP6) – volá je ListingsService:
 * premoderace, platnost, limity zdarma, omezené účty a automatické omezení po rizikovém obsahu.
 */
@Injectable()
export class ListingPolicyService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private trust: TrustService) {}

  premoderation() { return this.settings.get('premoderation'); }
  listingDays() { return this.settings.get('listingDays'); }
  async expiresAt() { return new Date(Date.now() + (await this.settings.get('listingDays')) * 864e5); }

  /** Kurz Kč za 1 EUR pro Listing.priceCzk. */
  eurRate() { return this.settings.get('eurRate'); }

  /** Limit nových inzerátů za hodinu (anti-spam). */
  maxPerHour() { return this.settings.get('maxListingsPerHour'); }

  /** Před zveřejněním: omezený účet ani účet bez souhlasu s aktuálními podmínkami nesmí zveřejňovat; soukromá osoba a neověřená firma mají limit aktivních inzerátů zdarma. */
  async beforePublish(userId: string, exceptListingId?: string, checkLimit = true) {
    await this.trust.assertMayPost(userId);
    const limit = await this.settings.get('freeActiveListings');
    if (!limit || !checkLimit) return;
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { isBusiness: true, companyVerifiedAt: true, role: true } });
    // Firma je bez limitu jen s ověřeným IČO (isBusiness si uživatel nastavuje sám)
    if (!u || (u.isBusiness && u.companyVerifiedAt) || u.role !== 'USER') return;
    const active = await this.prisma.listing.count({ where: { userId, status: { in: ['ACTIVE', 'PENDING', 'RESERVED'] }, ...(exceptListingId ? { id: { not: exceptListingId } } : {}) } });
    if (active >= limit) throw new BadRequestException(`Limit aktivních inzerátů zdarma je ${limit}. Ukončete některý starší inzerát, nebo si nechte ověřit firemní účet.`);
  }

  /** Po uložení: vysoce rizikový obsah → automatické omezení účtu. */
  async afterSave(userId: string, score: number, title: string) {
    await this.trust.afterRiskyContent(userId, score, `inzerát „${title}“`).catch(() => false);
  }
}
