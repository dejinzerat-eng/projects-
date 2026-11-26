/**
 * Převod inzerátu ze starého webu www.dejinzerat.cz na data nového systému (čisté funkce, bez databáze).
 * Starý web: 12 kategorií s podkategoriemi, popis v HTML, místo jen jako kraj, cena 0 = neuvedena.
 */
import { createHash } from 'crypto';
import { CITIES, REGIONS, normalizeSearchText } from '@dej/shared';

/** Inzerát, jak ho vrací starý web (výpis i detail). */
export interface LegacyListing {
  InzeratId: string;
  InzeratName: string;
  InzeratDescription: string | null;
  ShortDescription?: string | null;
  DateCreated: Date | string | null;
  ImgsPath: string | null;
  Price: number | null;
  Active?: boolean;
  Approved?: boolean;
  Status?: string;
  Location: string | null;
  UserId: number;
  CategoryId: number;
  SubcategoryId: number | null;
  user?: LegacyUser;
}

export interface LegacyUser {
  UserId: number;
  Username?: string | null;
  FullName?: string | null;
  Email?: string | null;
  TelNumber?: string | null;
  Banned?: boolean;
  Type?: string;
}

export type OfferTypeValue = 'SELL' | 'BUY' | 'EXCHANGE' | 'GIVE' | 'RENT';

/** Staré kategorie (id → adresa na starém webu a cíl v nové struktuře, když chybí podkategorie). */
export const LEGACY_CATEGORIES: Record<number, { slug: string; name: string; fallback: [string, string] }> = {
  1: { slug: 'auto-moto-lode', name: 'Auto, Moto, Lodě', fallback: ['auto-moto', 'osobni-auta'] },
  2: { slug: 'prace-a-podnikani', name: 'Práce a podnikání', fallback: ['prace', 'nabidka-prace'] },
  3: { slug: 'nemovitosti', name: 'Nemovitosti', fallback: ['reality', 'domy'] },
  4: { slug: 'elektro-a-pocitace', name: 'Elektro a počítače', fallback: ['pocitace', 'komponenty'] },
  5: { slug: 'domacnost', name: 'Domácnost', fallback: ['nabytek', 'dekorace'] },
  6: { slug: 'obleceni-a-obuv', name: 'Oblečení a obuv', fallback: ['obleceni', 'damske'] },
  7: { slug: 'zvirata', name: 'Zvířata', fallback: ['zvirata', 'psi'] },
  8: { slug: 'stavba-zahrada-stroje', name: 'Stavba, zahrada, stroje', fallback: ['dum-zahrada', 'stavebniny'] },
  9: { slug: 'zdravi-a-krasa', name: 'Zdraví a krása', fallback: ['ostatni', 'ruzne'] },
  10: { slug: 'pro-deti', name: 'Pro děti', fallback: ['deti', 'hracky'] },
  11: { slug: 'hobby-a-zaliby', name: 'Hobby a záliby', fallback: ['ostatni', 'ruzne'] },
  12: { slug: 'volny-cas-a-zabava', name: 'Volný čas a zábava', fallback: ['ostatni', 'ruzne'] },
};

/** Staré podkategorie → [hlavní, podkategorie] v novém systému. */
export const LEGACY_SUBCATEGORIES: Record<number, [string, string]> = {
  // Auto, Moto, Lodě
  113: ['auto-moto', 'osobni-auta'], 114: ['auto-moto', 'uzitkova-vozidla'], 115: ['auto-moto', 'uzitkova-vozidla'],
  116: ['auto-moto', 'motorky'], 117: ['auto-moto', 'nahradni-dily'], 118: ['auto-moto', 'nahradni-dily'],
  119: ['auto-moto', 'auto-prislusenstvi'], 120: ['auto-moto', 'auto-prislusenstvi'],
  // Práce a podnikání
  4: ['prace', 'nabidka-prace'], 5: ['prace', 'hledam-praci'], 6: ['prace', 'brigady'],
  // Nemovitosti (pronájem, komerční prostory, garáže upřesní refine)
  1: ['reality', 'byty'], 2: ['reality', 'domy'], 3: ['reality', 'pozemky'],
  // Elektro a počítače
  7: ['elektronika', 'audio'], 8: ['mobily', 'mobilni-telefony'], 9: ['mobily', 'tablety'], 10: ['pocitace', 'stolni-pc'],
  11: ['pocitace', 'notebooky'], 12: ['elektronika', 'herni-konzole'], 13: ['elektronika', 'herni-konzole'],
  14: ['pocitace', 'site-servery'], 15: ['pocitace', 'periferie'], 16: ['pocitace', 'periferie'], 17: ['pocitace', 'periferie'],
  // Domácnost
  18: ['elektronika', 'domaci-spotrebice'], 19: ['elektronika', 'domaci-spotrebice'], 20: ['elektronika', 'domaci-spotrebice'],
  21: ['nabytek', 'kuchyne'], 22: ['nabytek', 'obyvaci-pokoj'], 23: ['nabytek', 'koupelna'], 24: ['nabytek', 'obyvaci-pokoj'], 25: ['nabytek', 'dekorace'],
  // Volný čas a zábava
  26: ['hudba', 'desky'], 27: ['hudba', 'desky'], 28: ['hudba', 'studio'], 29: ['hudba', 'studio'], 30: ['knihy', 'beletrie'],
  31: ['ostatni', 'vstupenky'], 32: ['ostatni', 'vstupenky'],
  // Hobby a záliby
  33: ['sberatelstvi', 'mince'], 34: ['hobby', 'modelarstvi'], 35: ['potraviny', 'farmarske'], 36: ['sberatelstvi', 'starozitnosti'],
  37: ['sberatelstvi', 'starozitnosti'], 38: ['sberatelstvi', 'starozitnosti'], 39: ['obleceni', 'doplnky'], 40: ['sberatelstvi', 'umeni'],
  41: ['ostatni', 'ruzne'], 42: ['sberatelstvi', 'znamky'], 43: ['ostatni', 'ruzne'],
  // Pro děti
  44: ['deti', 'autosedacky'], 45: ['deti', 'detske-obleceni'], 46: ['deti', 'detske-obleceni'], 47: ['deti', 'detsky-nabytek'],
  48: ['deti', 'detsky-nabytek'], 49: ['deti', 'hracky'], 50: ['sport', 'cyklistika'], 51: ['deti', 'kocarky'], 52: ['deti', 'kocarky'],
  53: ['deti', 'detsky-nabytek'], 54: ['deti', 'detsky-nabytek'], 55: ['deti', 'hracky'], 56: ['deti', 'detsky-nabytek'],
  57: ['deti', 'hracky'], 58: ['knihy', 'ucebnice'],
  // Zdraví a krása (zboží nemá v nové struktuře vlastní kategorii, služby ano)
  59: ['ostatni', 'ruzne'], 60: ['ostatni', 'ruzne'], 61: ['ostatni', 'ruzne'], 62: ['sluzby', 'krasa'], 63: ['sluzby', 'krasa'],
  64: ['sluzby', 'krasa'], 65: ['ostatni', 'ruzne'],
  // Stavba, zahrada, stroje
  66: ['dum-zahrada', 'bazeny'], 67: ['dum-zahrada', 'bazeny'], 68: ['stroje-naradi', 'dilna'], 69: ['stroje-naradi', 'dilna'],
  70: ['dum-zahrada', 'rostliny'], 71: ['stroje-naradi', 'elektricke-naradi'], 72: ['dum-zahrada', 'vytapeni'],
  73: ['dum-zahrada', 'zahradni-technika'], 74: ['potraviny', 'zemedelska-technika'], 75: ['stroje-naradi', 'dilna'],
  // Zvířata
  76: ['zvirata', 'psi'], 77: ['zvirata', 'kocky'], 78: ['zvirata', 'akvaristika'], 79: ['zvirata', 'ptaci'],
  80: ['potraviny', 'hospodarska-zvirata'], 81: ['zvirata', 'chovatelske-potreby'], 82: ['potraviny', 'hospodarska-zvirata'],
  83: ['zvirata', 'psi'], 84: ['zvirata', 'psi'], 85: ['zvirata', 'hlodavci'], 86: ['zvirata', 'akvaristika'], 87: ['zvirata', 'chovatelske-potreby'],
  // Oblečení a obuv (bez rozlišení dámské/pánské – upřesní refine)
  88: ['obleceni', 'obuv'], 89: ['obleceni', 'damske'], 90: ['obleceni', 'panske'], 91: ['obleceni', 'doplnky'], 92: ['obleceni', 'doplnky'],
  93: ['obleceni', 'damske'], 94: ['obleceni', 'doplnky'], 95: ['obleceni', 'kabelky'], 96: ['obleceni', 'kabelky'], 97: ['obleceni', 'damske'],
  98: ['obleceni', 'damske'], 99: ['obleceni', 'damske'], 100: ['obleceni', 'damske'], 101: ['obleceni', 'panske'], 102: ['obleceni', 'damske'],
  103: ['obleceni', 'damske'], 104: ['obleceni', 'damske'], 105: ['obleceni', 'damske'], 106: ['obleceni', 'damske'], 107: ['obleceni', 'damske'],
  108: ['obleceni', 'damske'], 109: ['obleceni', 'doplnky'], 110: ['obleceni', 'damske'], 111: ['obleceni', 'damske'], 112: ['obleceni', 'damske'],
};

/** Upřesnění podle textu: [platí pro staré kategorie (prázdné = všechny), vzor v názvu/začátku popisu, cíl]. */
const REFINE: { cats?: number[]; subs?: number[]; re: RegExp; to: [string, string] }[] = [
  // služby vložené mezi zboží nebo práci
  { cats: [2, 5, 8, 11], re: /(tvorb\p{L}*\s+(\p{L}+\s+){0,3}(web|e-?shop)|webov\p{L}*\s+str[aá]nk|\bseo\b|marketing|reklam)/iu, to: ['sluzby', 'it-sluzby'] },
  { cats: [2, 5, 8, 11], re: /(zatepl|sanac|hydroizolac|rekonstrukc|stavebn\p{L}*\s+pr[aá]c|hodinov\p{L}*\s+man[žz]el|anhydrit|n[aá]t[ěe]r\p{L}*\s+st[řr]ech|[čc]i[šs]t[ěe]n\p{L}*\s+(a\s+\p{L}+\s+)?st[řr]ech|v[ýy]m[ěe]n\p{L}*\s+oken|vlhkost\p{L}*\s+ve\s+zdivu|3d\s+tisk|tiskovin|orienta[čc]n\p{L}*\s+syst|firemn\p{L}*\s+n[aá]pis)/iu, to: ['sluzby', 'remesla'] },
  { cats: [11, 12, 2], re: /(ubytov|penzion|azyl)/iu, to: ['hobby', 'vstupenky-zazitky'] },
  // reality
  { cats: [3], re: /gar[aá][žz]/iu, to: ['reality', 'garaze'] },
  { cats: [3], re: /(sklad|v[ýy]robn|kancel[aá][řr]|komer[čc]n|\bhal[ay]?\b)/iu, to: ['reality', 'komercni'] },
  { cats: [3], re: /(chat[ay]\b|chalup)/iu, to: ['reality', 'chaty-chalupy'] },
  { cats: [3], subs: [1], re: /(pron[aá]j|podn[aá]j)/iu, to: ['reality', 'byty-pronajem'] },
  // zvířata
  { cats: [7], re: /(ko[čc]k|kot[ěe]|ko[ťt]at|kocour|sphynx|britsk\p{L}*\s+kr[aá]tkosrst)/iu, to: ['zvirata', 'kocky'] },
  { cats: [7], re: /(papou[šs]|\bpt[aá][kc]|andulk|korel)/iu, to: ['zvirata', 'ptaci'] },
  { cats: [7], subs: [85, 83, 84], re: /(\bps[ií]k|\bpes\b|[šs]t[ěe]n|fenk)/iu, to: ['zvirata', 'psi'] },
  // auto
  { cats: [1], subs: [113], re: /(n[aá]hradn\p{L}*\s+d[ií]l|servo[čc]erpadl|h[řr]ebenov)/iu, to: ['auto-moto', 'nahradni-dily'] },
  // domácnost
  { cats: [5], re: /(kart[aá][čc]ek|vysava[čc]|[čc]isti[čc]k\p{L}*\s+vzduchu|lednic|pra[čc]k|my[čc]k|mikrovln|k[aá]vovar|spot[řr]ebi[čc])/iu, to: ['elektronika', 'domaci-spotrebice'] },
  // stavba, zahrada, stroje
  { cats: [8], re: /(plastov\p{L}*\s+okn|\bokn[oa]\b|st[řr]e[šs]n\p{L}*\s+okn|posuvn\p{L}*\s+dve[řr]|dve[řr]e|hs\s+port[aá]l|stavebnin)/iu, to: ['dum-zahrada', 'stavebniny'] },
  { cats: [8], re: /(dumper|bagr|rypadl|m[ií]cha[čc]k|le[šs]en[ií]|vibra[čc]n)/iu, to: ['stroje-naradi', 'stavebni-stroje'] },
  { cats: [8], subs: [73], re: /(alt[aá]n|pergol|domek|zahradn\p{L}*\s+n[aá]bytek)/iu, to: ['dum-zahrada', 'zahradni-nabytek'] },
  { cats: [8], subs: [73], re: /(d[řr]evin|rostlin|semen|sazenic|statice|limonk|stromk|ke[řr]e)/iu, to: ['dum-zahrada', 'rostliny'] },
  // hudební nástroje
  { subs: [28], re: /kytar|baskytar|ukulele/iu, to: ['hudba', 'kytary'] },
  { subs: [28], re: /kl[aá]ves|piano|klav[ií]r|pian/iu, to: ['hudba', 'klavesy'] },
  { subs: [28], re: /\bbic[ií]|bubn|[čc]inel/iu, to: ['hudba', 'bici'] },
  { subs: [28], re: /saxofon|trubk|fl[ée]tn|klarinet|trombon|dechov/iu, to: ['hudba', 'dechove'] },
  // oblečení: pánské
  { cats: [6], subs: [89, 93, 97, 98, 99, 100, 103, 105, 108, 111, 112], re: /(p[aá]nsk|mu[žz]sk)/iu, to: ['obleceni', 'panske'] },
];

/** Cílová kategorie [hlavní, podkategorie]. */
export function mapCategory(l: Pick<LegacyListing, 'CategoryId' | 'SubcategoryId' | 'InzeratName' | 'InzeratDescription'>): [string, string] {
  const base = (l.SubcategoryId != null && LEGACY_SUBCATEGORIES[l.SubcategoryId]) || LEGACY_CATEGORIES[l.CategoryId]?.fallback || ['ostatni', 'ruzne'];
  const text = `${l.InzeratName ?? ''}\n${htmlToText(l.InzeratDescription ?? '').slice(0, 300)}`;
  for (const r of REFINE) {
    if (r.cats && !r.cats.includes(l.CategoryId)) continue;
    if (r.subs && !(l.SubcategoryId != null && r.subs.includes(l.SubcategoryId)) && !(r.cats && l.SubcategoryId == null)) continue;
    if (r.re.test(text)) return r.to;
  }
  return base;
}

/** Typ nabídky: pronájem u realit, poptávka u „koupím / výkup / hledám“, jinak prodej. */
export function mapOfferType(l: Pick<LegacyListing, 'CategoryId' | 'SubcategoryId' | 'InzeratName'>): OfferTypeValue {
  const t = l.InzeratName ?? '';
  if (l.CategoryId === 3 && /(pron[aá]j|podn[aá]j)/iu.test(t)) return 'RENT';
  if (/^\s*(koup[ií]m|vykoup[ií]m|v[ýy]kup|sh[aá]n[ií]m|hled[aá]m|popt[aá]v)/iu.test(t)) return 'BUY';
  return 'SELL';
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', hellip: '…', bdquo: '„', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', euro: '€', copy: '©', deg: '°' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML popis (editor Quill) → prostý text s odstavci. Odkazy zůstanou jako text, značky zmizí. */
export function htmlToText(html: string): string {
  const s = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(ul|ol)[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|pre|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(s)
    .replace(/[​-‏‪-‮⁠﻿]/g, '')
    .replace(/\r/g, '')
    .split('\n').map((line) => line.replace(/[ \t ]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Název: bez nadbytečných mezer, nejvýše 90 znaků (zkrátí se na celé slovo). */
export function cleanTitle(t: string): string {
  const s = decodeEntities(t ?? '').replace(/[​-‏‪-‮﻿]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length <= 90) return s;
  const cut = s.slice(0, 90);
  const sp = cut.lastIndexOf(' ');
  return (sp > 60 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–-]+$/, '');
}

/** Popis pro nový systém (prostý text, 10–8000 znaků; prázdný popis nahradí název). */
export function cleanDescription(l: Pick<LegacyListing, 'InzeratDescription' | 'ShortDescription' | 'InzeratName'>): string {
  let d = htmlToText(l.InzeratDescription ?? '');
  if (d.replace(/[\s.•-]/g, '').length < 3) d = htmlToText(l.ShortDescription ?? '');
  if (d.replace(/[\s.•-]/g, '').length < 3) d = cleanTitle(l.InzeratName);
  if (d.length < 10) d = `${d}\n\n(Inzerát převzatý ze starého webu Dejinzerat.cz.)`;
  return d.length > 8000 ? `${d.slice(0, 7990).trimEnd()}…` : d;
}

/** Cena: 0 a 1 znamenaly na starém webu „neuvedeno“. */
export function cleanPrice(p: number | null | undefined): number | null {
  if (p == null || !Number.isFinite(p) || p <= 1) return null;
  return Math.min(Math.round(p), 2_000_000_000);
}

export interface MappedLocation { city: string; region: string; lat: number | null; lng: number | null }

const PRAHA = CITIES.find((c) => c.name === 'Praha')!;

/**
 * Starý web znal jen kraj. Město doplníme, jen když ho inzerát sám jmenuje (větší města daného kraje),
 * jinak se jako místo zobrazí kraj. Prázdné místo = celá ČR.
 */
export function mapLocation(location: string | null | undefined, text: string): MappedLocation {
  const loc = (location ?? '').trim();
  if (!loc) return { city: 'Celá ČR', region: '', lat: null, lng: null };
  const n = normalizeSearchText(loc);
  if (n === 'praha' || n === 'hlavni mesto praha') return { city: 'Praha', region: 'PHA', lat: PRAHA.lat, lng: PRAHA.lng };
  const region = REGIONS.find((r) => normalizeSearchText(r.name) === n);
  if (!region) return { city: loc.slice(0, 80), region: '', lat: null, lng: null };
  const t = ` ${normalizeSearchText(text)} `;
  const city = CITIES.filter((c) => c.region === region.code).sort((a, b) => b.name.length - a.name.length)
    .find((c) => t.includes(` ${normalizeSearchText(c.name)} `));
  if (city) return { city: city.name, region: region.code, lat: city.lat, lng: city.lng };
  return { city: region.name, region: region.code, lat: null, lng: null };
}

/** Telefon do tvaru +420123456789 (CZ/SK), jinak null. */
export function normalizePhone(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let d = tel.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  const digits = d.replace(/\D/g, '');
  if (/^\d{9}$/.test(digits) && !d.startsWith('+')) return `+420${digits}`;
  if (/^(420|421)\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i;

/** E-mail prodejce (malá písmena), nebo null, když na starém webu chybí či je neplatný. */
export function cleanEmail(e: string | null | undefined): string | null {
  const s = (e ?? '').trim().toLowerCase();
  return s.length <= 254 && EMAIL.test(s) ? s : null;
}

export function sellerName(u: Pick<LegacyUser, 'FullName' | 'Username'>): string {
  const n = (u.FullName ?? '').trim() || (u.Username ?? '').trim() || 'Prodejce';
  return n.replace(/\s+/g, ' ').slice(0, 60);
}

/** Bezpečné jméno fotky ze starého webu (žádné cesty, jen soubor obrázku). */
export function imageNames(imgsPath: string | null | undefined): string[] {
  let arr: unknown;
  try { arr = JSON.parse(imgsPath ?? '[]'); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.filter((x): x is string => typeof x === 'string' && /^[a-z0-9_-]{1,80}\.(webp|jpe?g|png)$/i.test(x)).slice(0, 20);
}

/** ID inzerátu na starém webu: UUID, u nejstarších inzerátů číslo. */
export const LEGACY_LISTING_ID = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{1,12})$/i;

export const legacyUserId = (id: number) => `dejinzerat:${id}`;

/** Otisk zdrojových dat – změní se, když prodejce na starém webu inzerát upraví. */
export function sourceHash(l: LegacyListing): string {
  const pick = { n: l.InzeratName, d: l.InzeratDescription, s: l.ShortDescription ?? '', p: l.Price, c: l.CategoryId, sc: l.SubcategoryId, loc: l.Location, img: l.ImgsPath, u: l.UserId };
  return createHash('sha256').update(JSON.stringify(pick)).digest('hex').slice(0, 24);
}

/** Otisk toho, co import zapsal do nového inzerátu – podle něj poznáme, že ho mezitím někdo upravil v novém systému. */
export function writtenHash(w: { title: string; description: string; price: number | null; categoryId: string }): string {
  return createHash('sha256').update(JSON.stringify([w.title, w.description, w.price, w.categoryId])).digest('hex').slice(0, 24);
}

export const joinLegacyHash = (source: string, written: string) => `${source}:${written}`;
export function splitLegacyHash(h: string | null | undefined): { source: string | null; written: string | null } {
  const [source, written] = (h ?? '').split(':');
  return { source: source || null, written: written || null };
}
