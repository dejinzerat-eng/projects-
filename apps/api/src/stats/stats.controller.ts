import { Controller, Get, Query } from '@nestjs/common';
import { Auth, AuthUser, CurrentUser } from '../common/auth.guard';
import { PrismaService } from '../common/prisma.service';
import { addDays, buildSellerStats, dayToDate, parsePeriod, pragueDay } from './seller-stats';

@Controller()
export class StatsController {
  constructor(private prisma: PrismaService) {}

  /** Statistiky prodejce: souhrn, denní graf a čísla u každého inzerátu. `dny` = 7 | 30 | 90. */
  @Auth()
  @Get('me/stats')
  async mine(@CurrentUser() u: AuthUser, @Query('dny') dny?: string) {
    const days = parsePeriod(dny);
    const today = pragueDay();
    const from = addDays(today, -(days - 1));
    // Pražská půlnoc je nejdřív 22:00 UTC předchozího dne – vezmeme rezervu a přesně dofiltrujeme podle dne.
    const since = new Date(dayToDate(from).getTime() - 3 * 36e5);

    const rows = await this.prisma.listing.findMany({
      where: { userId: u.id, status: { not: 'DELETED' } },
      select: {
        id: true, slug: true, title: true, status: true, price: true, priceNegotiable: true, currency: true, views: true,
        images: { orderBy: { position: 'asc' }, take: 1, select: { thumbUrl: true } },
        _count: { select: { favorites: true, conversations: true } },
      },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
    const ids = rows.map((l) => l.id);
    const [statRows, favorites, conversations, first] = ids.length ? await Promise.all([
      this.prisma.listingStatDay.findMany({ where: { listingId: { in: ids }, day: { gte: dayToDate(from) } }, select: { listingId: true, day: true, views: true, phoneReveals: true } }),
      this.prisma.favorite.findMany({ where: { listingId: { in: ids }, createdAt: { gte: since }, userId: { not: u.id } }, select: { listingId: true, createdAt: true } }),
      this.prisma.conversation.findMany({ where: { listingId: { in: ids }, sellerId: u.id, createdAt: { gte: since } }, select: { listingId: true, createdAt: true } }),
      this.prisma.listingStatDay.findFirst({ where: { listingId: { in: ids } }, orderBy: { day: 'asc' }, select: { day: true } }),
    ]) : [[], [], [], null];

    return buildSellerStats({
      days, today, statRows, favorites, conversations, trackingSince: first?.day ?? null,
      listings: rows.map((l) => ({
        id: l.id, slug: l.slug, title: l.title, status: l.status, image: l.images[0]?.thumbUrl ?? null,
        price: l.price, priceNegotiable: l.priceNegotiable, currency: l.currency,
        views: l.views, favorites: l._count.favorites, conversations: l._count.conversations,
      })),
    });
  }
}
