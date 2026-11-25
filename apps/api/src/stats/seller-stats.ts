import { Logger } from '@nestjs/common';
import type { PrismaService } from '../common/prisma.service';

/** Povolené délky období v přehledu (dny). */
export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const parsePeriod = (v: unknown): Period => (PERIODS as readonly number[]).includes(Number(v)) ? (Number(v) as Period) : 30;

const DAY_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Kalendářní den v Praze jako 'YYYY-MM-DD' (prodejci počítají dny podle českého času, ne UTC). */
export const pragueDay = (d: Date = new Date()) => DAY_FMT.format(d);

/** Posune den 'YYYY-MM-DD' o n dní (bez vlivu časových pásem). */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Hodnota pro sloupec typu DATE (půlnoc UTC daného dne). */
export const dayToDate = (day: string) => new Date(`${day}T00:00:00Z`);

const log = new Logger('SellerStats');

/**
 * Připočte zobrazení detailu nebo telefonu do dnešního dne. Jedním atomickým příkazem,
 * takže souběžné návštěvy se nepřepíšou. Chyba statistik nikdy nerozbije zobrazení inzerátu.
 */
export async function recordListingStat(prisma: PrismaService, listingId: string, kind: 'views' | 'phoneReveals', now = new Date()) {
  const day = dayToDate(pragueDay(now));
  try {
    if (kind === 'views') {
      await prisma.$executeRaw`INSERT INTO "ListingStatDay" ("listingId", "day", "views") VALUES (${listingId}, ${day}, 1)
        ON CONFLICT ("listingId", "day") DO UPDATE SET "views" = "ListingStatDay"."views" + 1`;
    } else {
      await prisma.$executeRaw`INSERT INTO "ListingStatDay" ("listingId", "day", "phoneReveals") VALUES (${listingId}, ${day}, 1)
        ON CONFLICT ("listingId", "day") DO UPDATE SET "phoneReveals" = "ListingStatDay"."phoneReveals" + 1`;
    }
  } catch (e) {
    log.warn(`Statistiku inzerátu ${listingId} se nepodařilo uložit: ${(e as Error).message}`);
  }
}

export interface StatListing {
  id: string; slug: string; title: string; status: string; image: string | null;
  price: number | null; priceNegotiable: boolean; currency: string;
  /** Celkové hodnoty za celou dobu inzerátu */
  views: number; favorites: number; conversations: number;
}
export interface StatRow { listingId: string; day: Date; views: number; phoneReveals: number }
export interface EventRow { listingId: string; createdAt: Date }

export interface SellerStats {
  days: Period; from: string; to: string;
  totals: { listings: number; active: number; views: number; favorites: number; conversations: number };
  period: { views: number; phoneReveals: number; favorites: number; conversations: number };
  daily: { date: string; views: number; phoneReveals: number; favorites: number; conversations: number }[];
  listings: (StatListing & { periodViews: number; periodPhoneReveals: number; periodFavorites: number; periodConversations: number })[];
  /** První den, od kterého máme denní zobrazení (starší zobrazení jsou jen v celkovém součtu). */
  trackingSince: string | null;
}

/**
 * Sestaví přehled pro prodejce z hrubých dat. Čistá funkce (bez DB), aby šla otestovat.
 * - `statRows`: denní zobrazení a zobrazení telefonu
 * - `favorites`, `conversations`: kdy kdo uložil inzerát / napsal k němu poprvé
 */
export function buildSellerStats(input: {
  days: Period; today: string; listings: StatListing[]; statRows: StatRow[];
  favorites: EventRow[]; conversations: EventRow[]; trackingSince: Date | null;
}): SellerStats {
  const { days, today, listings } = input;
  const from = addDays(today, -(days - 1));
  const daily = Array.from({ length: days }, (_, i) => ({ date: addDays(from, i), views: 0, phoneReveals: 0, favorites: 0, conversations: 0 }));
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const per = new Map(listings.map((l) => [l.id, { periodViews: 0, periodPhoneReveals: 0, periodFavorites: 0, periodConversations: 0 }]));

  for (const r of input.statRows) {
    const d = byDate.get(r.day.toISOString().slice(0, 10)); const p = per.get(r.listingId);
    if (!d || !p) continue;
    d.views += r.views; d.phoneReveals += r.phoneReveals;
    p.periodViews += r.views; p.periodPhoneReveals += r.phoneReveals;
  }
  for (const [rows, key, pkey] of [[input.favorites, 'favorites', 'periodFavorites'], [input.conversations, 'conversations', 'periodConversations']] as const) {
    for (const r of rows) {
      const d = byDate.get(pragueDay(r.createdAt)); const p = per.get(r.listingId);
      if (!d || !p) continue;
      d[key]++; p[pkey]++;
    }
  }

  const sum = (k: 'views' | 'phoneReveals' | 'favorites' | 'conversations') => daily.reduce((a, d) => a + d[k], 0);
  return {
    days, from, to: today,
    totals: {
      listings: listings.length, active: listings.filter((l) => l.status === 'ACTIVE').length,
      views: listings.reduce((a, l) => a + l.views, 0), favorites: listings.reduce((a, l) => a + l.favorites, 0), conversations: listings.reduce((a, l) => a + l.conversations, 0),
    },
    period: { views: sum('views'), phoneReveals: sum('phoneReveals'), favorites: sum('favorites'), conversations: sum('conversations') },
    daily,
    listings: listings
      .map((l) => ({ ...l, ...per.get(l.id)! }))
      .sort((a, b) => b.periodViews - a.periodViews || b.periodConversations - a.periodConversations || b.views - a.views),
    trackingSince: input.trackingSince ? input.trackingSince.toISOString().slice(0, 10) : null,
  };
}
