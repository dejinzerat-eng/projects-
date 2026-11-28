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
  1: { slug: 'auto-moto-lode', name: 'Auto, Moto, Lodě', fallback: ['auto-moto', 'osobni-automobily'] },
  2: { slug: 'prace-a-podnikani', name: 'Práce a podnikání', fallback: ['prace-a-brigady', 'nabidka-prace'] },
  3: { slug: 'nemovitosti', name: 'Nemovitosti', fallback: ['reality', 'domy'] },
  4: { slug: 'elektro-a-pocitace', name: 'Elektro a počítače', fallback: ['pocitace-a-it', 'komponenty'] },
  5: { slug: 'domacnost', name: 'Domácnost', fallback: ['nabytek-a-bydleni', 'dekorace-a-doplnky'] },
  6: { slug: 'obleceni-a-obuv', name: 'Oblečení a obuv', fallback: ['obleceni-a-obuv', 'damske-obleceni'] },
  7: { slug: 'zvirata', name: 'Zvířata', fallback: ['zvirata-a-chovatelske-potreby', 'psi'] },
  8: { slug: 'stavba-zahrada-stroje', name: 'Stavba, zahrada, stroje', fallback: ['dum-a-zahrada', 'stavebniny'] },
  9: { slug: 'zdravi-a-krasa', name: 'Zdraví a krása', fallback: ['ostatni', 'ruzne'] },
  10: { slug: 'pro-deti', name: 'Pro děti', fallback: ['deti-a-kojenecke-potreby', 'hracky'] },
  11: { slug: 'hobby-a-zaliby', name: 'Hobby a záliby', fallback: ['ostatni', 'ruzne'] },
  12: { slug: 'volny-cas-a-zabava', name: 'Volný čas a zábava', fallback: ['ostatni', 'ruzne'] },
};

/** Staré podkategorie → [hlavní, podkategorie] v novém systému. */
export const LEGACY_SUBCATEGORIES: Record<number, [string, string]> = {
  // Auto, Moto, Lodě
  113: ['auto-moto', 'osobni-automobily'], 114: ['auto-moto', 'uzitkove-vozy'], 115: ['auto-moto', 'uzitkove-vozy'],
  116: ['auto-moto', 'motocykly-a-skutry'], 117: ['auto-moto', 'nahradni-dily'], 118: ['auto-moto', 'nahradni-dily'],
  119: ['auto-moto', 'prislusenstvi'], 120: ['auto-moto', 'prislusenstvi'],
  // Práce a podnikání
  4: ['prace-a-brigady', 'nabidka-prace'], 5: ['prace-a-brigady', 'hledam-praci'], 6: ['prace-a-brigady', 'brigady'],
  // Nemovitosti (pronájem, komerční prostory, garáže upřesní refine)
  1: ['reality', 'byty-na-prodej'], 2: ['reality', 'domy'], 3: ['reality', 'pozemky'],
  // Elektro a počítače
  7: ['elektronika', 'audio-technika'], 8: ['mobily-a-prislusenstvi', 'mobilni-telefony'], 9: ['mobily-a-prislusenstvi', 'tablety'], 10: ['pocitace-a-it', 'stolni-pocitace'],
  11: ['pocitace-a-it', 'notebooky'], 12: ['elektronika', 'herni-konzole'], 13: ['elektronika', 'herni-konzole'],
  14: ['pocitace-a-it', 'site-a-servery'], 15: ['pocitace-a-it', 'periferie-a-prislusenstvi'], 16: ['pocitace-a-it', 'periferie-a-prislusenstvi'], 17: ['pocitace-a-it', 'periferie-a-prislusenstvi'],
  // Domácnost
  18: ['elektronika', 'domaci-spotrebice'], 19: ['elektronika', 'domaci-spotrebice'], 20: ['elektronika', 'domaci-spotrebice'],
  21: ['nabytek-a-bydleni', 'kuchyne-a-jidelna'], 22: ['nabytek-a-bydleni', 'obyvaci-pokoj'], 23: ['nabytek-a-bydleni', 'koupelna'], 24: ['nabytek-a-bydleni', 'obyvaci-pokoj'], 25: ['nabytek-a-bydleni', 'dekorace-a-doplnky'],
  // Volný čas a zábava
  26: ['hudba-a-hudebni-nastroje', 'desky-cd-a-noty'], 27: ['hudba-a-hudebni-nastroje', 'desky-cd-a-noty'], 28: ['hudba-a-hudebni-nastroje', 'studio-a-ozvuceni'], 29: ['hudba-a-hudebni-nastroje', 'studio-a-ozvuceni'], 30: ['knihy-a-ucebnice', 'beletrie'],
  31: ['ostatni', 'vstupenky-a-poukazy'], 32: ['ostatni', 'vstupenky-a-poukazy'],
  // Hobby a záliby
  33: ['sberatelstvi-a-starozitnosti', 'mince-a-bankovky'], 34: ['hobby-a-volny-cas', 'modelarstvi'], 35: ['potraviny-a-zemedelstvi', 'farmarske-potraviny'], 36: ['sberatelstvi-a-starozitnosti', 'starozitnosti'],
  37: ['sberatelstvi-a-starozitnosti', 'starozitnosti'], 38: ['sberatelstvi-a-starozitnosti', 'starozitnosti'], 39: ['obleceni-a-obuv', 'doplnky-a-sperky'], 40: ['sberatelstvi-a-starozitnosti', 'obrazy-a-umeni'],
  41: ['ostatni', 'ruzne'], 42: ['sberatelstvi-a-starozitnosti', 'znamky'], 43: ['ostatni', 'ruzne'],
  // Pro děti
  44: ['deti-a-kojenecke-potreby', 'autosedacky'], 45: ['deti-a-kojenecke-potreby', 'detske-obleceni'], 46: ['deti-a-kojenecke-potreby', 'detske-obleceni'], 47: ['deti-a-kojenecke-potreby', 'detsky-nabytek'],
  48: ['deti-a-kojenecke-potreby', 'detsky-nabytek'], 49: ['deti-a-kojenecke-potreby', 'hracky'], 50: ['sport-a-volny-cas', 'cyklistika'], 51: ['deti-a-kojenecke-potreby', 'kocarky'], 52: ['deti-a-kojenecke-potreby', 'kocarky'],
  53: ['deti-a-kojenecke-potreby', 'detsky-nabytek'], 54: ['deti-a-kojenecke-potreby', 'detsky-nabytek'], 55: ['deti-a-kojenecke-potreby', 'hracky'], 56: ['deti-a-kojenecke-potreby', 'detsky-nabytek'],
  57: ['deti-a-kojenecke-potreby', 'hracky'], 58: ['knihy-a-ucebnice', 'ucebnice-a-skripta'],
  // Zdraví a krása (zboží nemá v nové struktuře vlastní kategorii, služby ano)
  59: ['ostatni', 'ruzne'], 60: ['ostatni', 'ruzne'], 61: ['ostatni', 'ruzne'], 62: ['sluzby-a-remesla', 'krasa-a-zdravi'], 63: ['sluzby-a-remesla', 'krasa-a-zdravi'],
  64: ['sluzby-a-remesla', 'krasa-a-zdravi'], 65: ['ostatni', 'ruzne'],
  // Stavba, zahrada, stroje
  66: ['dum-a-zahrada', 'bazeny-a-virivky'], 67: ['dum-a-zahrada', 'bazeny-a-virivky'], 68: ['stroje-a-naradi', 'dilenske-vybaveni'], 69: ['stroje-a-naradi', 'dilenske-vybaveni'],
  70: ['dum-a-zahrada', 'rostliny-a-semena'], 71: ['stroje-a-naradi', 'elektricke-naradi'], 72: ['dum-a-zahrada', 'vytapeni-a-klimatizace'],
  73: ['dum-a-zahrada', 'zahradni-technika'], 74: ['potraviny-a-zemedelstvi', 'zemedelska-technika'], 75: ['stroje-a-naradi', 'dilenske-vybaveni'],
  // Zvířata
  76: ['zvirata-a-chovatelske-potreby', 'psi'], 77: ['zvirata-a-chovatelske-potreby', 'kocky'], 78: ['zvirata-a-chovatelske-potreby', 'akvaristika-a-teraristika'], 79: ['zvirata-a-chovatelske-potreby', 'ptaci'],
  80: ['potraviny-a-zemedelstvi', 'hospodarska-zvirata'], 81: ['zvirata-a-chovatelske-potreby', 'chovatelske-potreby'], 82: ['potraviny-a-zemedelstvi', 'hospodarska-zvirata'],
  83: ['zvirata-a-chovatelske-potreby', 'psi'], 84: ['zvirata-a-chovatelske-potreby', 'psi'], 85: ['zvirata-a-chovatelske-potreby', 'hlodavci'], 86: ['zvirata-a-chovatelske-potreby', 'akvaristika-a-teraristika'], 87: ['zvirata-a-chovatelske-potreby', 'chovatelske-potreby'],
  // Oblečení a obuv (bez rozlišení dámské/pánské – upřesní refine)
  88: ['obleceni-a-obuv', 'obuv'], 89: ['obleceni-a-obuv', 'damske-obleceni'], 90: ['obleceni-a-obuv', 'panske-obleceni'], 91: ['obleceni-a-obuv', 'doplnky-a-sperky'], 92: ['obleceni-a-obuv', 'doplnky-a-sperky'],
  93: ['obleceni-a-obuv', 'damske-obleceni'], 94: ['obleceni-a-obuv', 'doplnky-a-sperky'], 95: ['obleceni-a-obuv', 'kabelky-a-tasky'], 96: ['obleceni-a-obuv', 'kabelky-a-tasky'], 97: ['obleceni-a-obuv', 'damske-obleceni'],
  98: ['obleceni-a-obuv', 'damske-obleceni'], 99: ['obleceni-a-obuv', 'damske-obleceni'], 100: ['obleceni-a-obuv', 'damske-obleceni'], 101: ['obleceni-a-obuv', 'panske-obleceni'], 102: ['obleceni-a-obuv', 'damske-obleceni'],
  103: ['obleceni-a-obuv', 'damske-obleceni'], 104: ['obleceni-a-obuv', 'damske-obleceni'], 105: ['obleceni-a-obuv', 'damske-obleceni'], 106: ['obleceni-a-obuv', 'damske-obleceni'], 107: ['obleceni-a-obuv', 'damske-obleceni'],
  108: ['obleceni-a-obuv', 'damske-obleceni'], 109: ['obleceni-a-obuv', 'doplnky-a-sperky'], 110: ['obleceni-a-obuv', 'damske-obleceni'], 111: ['obleceni-a-obuv', 'damske-obleceni'], 112: ['obleceni-a-obuv', 'damske-obleceni'],
};

/** Upřesnění podle textu: [platí pro staré kategorie (prázdné = všechny), vzor v názvu/začátku popisu, cíl]. */
const REFINE: { cats?: number[]; subs?: number[]; re: RegExp; to: [string, string] }[] = [
  // služby vložené mezi zboží nebo práci
  { cats: [2, 5, 8, 11], re: /(tvorb\p{L}*\s+(\p{L}+\s+){0,3}(web|e-?shop)|webov\p{L}*\s+str[aá]nk|\bseo\b|marketing|reklam)/iu, to: ['sluzby-a-remesla', 'it-a-web'] },
  { cats: [2, 5, 8, 11], re: /(zatepl|sanac|hydroizolac|rekonstrukc|stavebn\p{L}*\s+pr[aá]c|hodinov\p{L}*\s+man[žz]el|anhydrit|n[aá]t[ěe]r\p{L}*\s+st[řr]ech|[čc]i[šs]t[ěe]n\p{L}*\s+(a\s+\p{L}+\s+)?st[řr]ech|v[ýy]m[ěe]n\p{L}*\s+oken|vlhkost\p{L}*\s+ve\s+zdivu|3d\s+tisk|tiskovin|orienta[čc]n\p{L}*\s+syst|firemn\p{L}*\s+n[aá]pis)/iu, to: ['sluzby-a-remesla', 'remesla-a-opravy'] },
  { cats: [11, 12, 2], re: /(ubytov|penzion|azyl)/iu, to: ['hobby-a-volny-cas', 'zazitky-a-cestovani'] },
  // reality
  { cats: [3], re: /gar[aá][žz]/iu, to: ['reality', 'garaze'] },
  { cats: [3], re: /(sklad|v[ýy]robn|kancel[aá][řr]|komer[čc]n|\bhal[ay]?\b)/iu, to: ['reality', 'komercni-prostory'] },
  { cats: [3], re: /(chat[ay]\b|chalup)/iu, to: ['reality', 'chaty-a-chalupy'] },
  { cats: [3], subs: [1], re: /(pron[aá]j|podn[aá]j)/iu, to: ['reality', 'byty-k-pronajmu'] },
  // zvířata
  { cats: [7], re: /(ko[čc]k|kot[ěe]|ko[ťt]at|kocour|sphynx|britsk\p{L}*\s+kr[aá]tkosrst)/iu, to: ['zvirata-a-chovatelske-potreby', 'kocky'] },
  { cats: [7], re: /(papou[šs]|\bpt[aá][kc]|andulk|korel)/iu, to: ['zvirata-a-chovatelske-potreby', 'ptaci'] },
  { cats: [7], subs: [85, 83, 84], re: /(\bps[ií]k|\bpes\b|[šs]t[ěe]n|fenk)/iu, to: ['zvirata-a-chovatelske-potreby', 'psi'] },
  // auto
  { cats: [1], subs: [113], re: /(n[aá]hradn\p{L}*\s+d[ií]l|servo[čc]erpadl|h[řr]ebenov)/iu, to: ['auto-moto', 'nahradni-dily'] },
  // domácnost
  { cats: [5], re: /(kart[aá][čc]ek|vysava[čc]|[čc]isti[čc]k\p{L}*\s+vzduchu|lednic|pra[čc]k|my[čc]k|mikrovln|k[aá]vovar|spot[řr]ebi[čc])/iu, to: ['elektronika', 'domaci-spotrebice'] },
  // stavba, zahrada, stroje
  { cats: [8], re: /(plastov\p{L}*\s+okn|\bokn[oa]\b|st[řr]e[šs]n\p{L}*\s+okn|posuvn\p{L}*\s+dve[řr]|dve[řr]e|hs\s+port[aá]l|stavebnin)/iu, to: ['dum-a-zahrada', 'stavebniny'] },
  { cats: [8], re: /(dumper|bagr|rypadl|m[ií]cha[čc]k|le[šs]en[ií]|vibra[čc]n)/iu, to: ['stroje-a-naradi', 'stavebni-stroje'] },
  { cats: [8], subs: [73], re: /(alt[aá]n|pergol|domek|zahradn\p{L}*\s+n[aá]bytek)/iu, to: ['dum-a-zahrada', 'zahradni-nabytek'] },
  { cats: [8], subs: [73], re: /(d[řr]evin|rostlin|semen|sazenic|statice|limonk|stromk|ke[řr]e)/iu, to: ['dum-a-zahrada', 'rostliny-a-semena'] },
  // hudební nástroje
  { subs: [28], re: /kytar|baskytar|ukulele/iu, to: ['hudba-a-hudebni-nastroje', 'kytary-a-baskytary'] },
  { subs: [28], re: /kl[aá]ves|piano|klav[ií]r|pian/iu, to: ['hudba-a-hudebni-nastroje', 'klavesy-a-piana'] },
  { subs: [28], re: /\bbic[ií]|bubn|[čc]inel/iu, to: ['hudba-a-hudebni-nastroje', 'bici-nastroje'] },
  { subs: [28], re: /saxofon|trubk|fl[ée]tn|klarinet|trombon|dechov/iu, to: ['hudba-a-hudebni-nastroje', 'dechove-nastroje'] },
  // oblečení: pánské
  { cats: [6], subs: [89, 93, 97, 98, 99, 100, 103, 105, 108, 111, 112], re: /(p[aá]nsk|mu[žz]sk)/iu, to: ['obleceni-a-obuv', 'panske-obleceni'] },
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
  if (d.length < 10) d = `${d}\n\n(Inzerát převzatý ze starého webu DEJINZERAT.cz.)`;
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
