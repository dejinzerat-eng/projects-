/**
 * Adresy starého webu www.dejinzerat.cz a jejich nové ekvivalenty. Použije je přesměrování na webu
 * (next.config.ts) po přepnutí domény na nový systém; inzeráty /produkt?id=… řeší stránka /produkt.
 */
export const LEGACY_CATEGORY_PATHS: Record<string, string> = {
  'auto-moto-lode': '/kategorie/auto-moto',
  'prace-a-podnikani': '/kategorie/prace',
  nemovitosti: '/kategorie/reality',
  'elektro-a-pocitace': '/kategorie/elektronika',
  domacnost: '/kategorie/nabytek',
  'obleceni-a-obuv': '/kategorie/obleceni',
  zvirata: '/kategorie/zvirata',
  'stavba-zahrada-stroje': '/kategorie/dum-zahrada',
  'zdravi-a-krasa': '/kategorie/sluzby/krasa',
  'pro-deti': '/kategorie/deti',
  'hobby-a-zaliby': '/kategorie/hobby',
  'volny-cas-a-zabava': '/kategorie/hobby',
};

export const LEGACY_PAGE_PATHS: Record<string, string> = {
  '/nejnovejsi-inzeraty': '/hledat',
  '/login': '/prihlaseni',
  '/uzivatel/pridat-inzerat': '/pridat',
  '/uzivatel': '/muj-ucet',
  '/premium': '/cenik',
  '/reklama': '/stranka/kontakt',
  '/napiste-nam': '/stranka/kontakt',
  '/podminky': '/stranka/podminky',
  '/ochrana-osobnich-udaju': '/stranka/ochrana-udaju',
};

/** Trvalá přesměrování starých adres (bez těch, které se nezměnily). */
export function legacyRedirects(): { from: string; to: string }[] {
  const cats = Object.entries(LEGACY_CATEGORY_PATHS).map(([slug, to]) => ({ from: `/kategorie/${slug}`, to })).filter((r) => r.from !== r.to);
  return [...cats, ...Object.entries(LEGACY_PAGE_PATHS).map(([from, to]) => ({ from, to }))];
}
