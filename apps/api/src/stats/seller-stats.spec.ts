import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildSellerStats, parsePeriod, pragueDay, type StatListing } from './seller-stats';

const listing = (id: string, over: Partial<StatListing> = {}): StatListing => ({
  id, slug: `inzerat-${id}`, title: `Inzerát ${id}`, status: 'ACTIVE', image: null,
  price: 1000, priceNegotiable: false, currency: 'CZK', views: 0, favorites: 0, conversations: 0, ...over,
});
const day = (s: string) => new Date(`${s}T00:00:00Z`);

test('pražský den: půlnoc v Praze je v UTC ještě předchozí den', () => {
  assert.equal(pragueDay(new Date('2026-11-24T23:30:00Z')), '2026-11-25'); // zima, UTC+1
  assert.equal(pragueDay(new Date('2026-07-01T22:30:00Z')), '2026-07-02'); // léto, UTC+2
  assert.equal(pragueDay(new Date('2026-11-25T12:00:00Z')), '2026-11-25');
});

test('posun dne přes konec měsíce a roku', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('období: povolené jen 7, 30 a 90 dní, jinak 30', () => {
  assert.equal(parsePeriod('7'), 7);
  assert.equal(parsePeriod('90'), 90);
  assert.equal(parsePeriod('365'), 30);
  assert.equal(parsePeriod(undefined), 30);
  assert.equal(parsePeriod('abc'), 30);
});

test('denní řada má přesně N dní včetně dneška a prázdné dny jsou nuly', () => {
  const s = buildSellerStats({ days: 7, today: '2026-11-25', listings: [], statRows: [], favorites: [], conversations: [], trackingSince: null });
  assert.equal(s.daily.length, 7);
  assert.equal(s.from, '2026-11-19');
  assert.equal(s.daily[0].date, '2026-11-19');
  assert.equal(s.daily.at(-1)!.date, '2026-11-25');
  assert.ok(s.daily.every((d) => d.views === 0 && d.favorites === 0));
  assert.deepEqual(s.period, { views: 0, phoneReveals: 0, favorites: 0, conversations: 0 });
  assert.equal(s.trackingSince, null);
});

test('sečte zobrazení, telefony, uložení a konverzace po dnech i po inzerátech', () => {
  const s = buildSellerStats({
    days: 7, today: '2026-11-25',
    listings: [listing('a', { views: 500, favorites: 4, conversations: 2 }), listing('b', { views: 20, status: 'SOLD' })],
    statRows: [
      { listingId: 'a', day: day('2026-11-25'), views: 10, phoneReveals: 2 },
      { listingId: 'a', day: day('2026-11-24'), views: 5, phoneReveals: 0 },
      { listingId: 'b', day: day('2026-11-24'), views: 30, phoneReveals: 1 },
      { listingId: 'a', day: day('2026-11-10'), views: 99, phoneReveals: 9 }, // mimo období
      { listingId: 'cizi', day: day('2026-11-25'), views: 99, phoneReveals: 9 }, // cizí inzerát
    ],
    favorites: [{ listingId: 'a', createdAt: new Date('2026-11-24T23:30:00Z') }], // = 25. 11. v Praze
    conversations: [{ listingId: 'b', createdAt: new Date('2026-11-20T10:00:00Z') }, { listingId: 'a', createdAt: new Date('2026-11-01T10:00:00Z') }],
    trackingSince: day('2026-11-10'),
  });
  assert.deepEqual(s.period, { views: 45, phoneReveals: 3, favorites: 1, conversations: 1 });
  assert.deepEqual(s.totals, { listings: 2, active: 1, views: 520, favorites: 4, conversations: 2 });
  const d25 = s.daily.find((d) => d.date === '2026-11-25')!;
  assert.equal(d25.views, 10);
  assert.equal(d25.favorites, 1);
  // Seřazeno podle zobrazení v období: b (30) před a (15)
  assert.deepEqual(s.listings.map((l) => [l.id, l.periodViews, l.periodPhoneReveals, l.periodFavorites, l.periodConversations]), [['b', 30, 1, 0, 1], ['a', 15, 2, 1, 0]]);
  assert.equal(s.trackingSince, '2026-11-10');
});
