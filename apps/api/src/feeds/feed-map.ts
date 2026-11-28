/**
 * Převod položky feedu na náš inzerát (čisté funkce, testy v feed-map.spec.ts):
 * přiřazení polí (předvolby Heureka / Google + odhad podle názvů), cena, stav, typ nabídky,
 * parametry kategorie (značka, rok, najeto, palivo, dispozice, plocha…) a odhad kategorie.
 */
import { cleanParams, normalizeSearchText, type AttrValue, type FilterDef } from '@dej/shared';
import { createHash } from 'crypto';
import { cleanTitle, htmlToText } from '../legacy/legacy-map';
import type { FeedFormat, FieldInfo, RawItem } from './feed-parse';

export const CORE_FIELDS = ['id', 'title', 'description', 'price', 'currency', 'url', 'images', 'category', 'city', 'zip', 'condition', 'offer', 'model'] as const;
export const ATTR_FIELDS = ['brand', 'year', 'mileage', 'fuel', 'gearbox', 'body', 'power', 'layout', 'area', 'ownership', 'energy', 'size'] as const;
export type FieldKey = (typeof CORE_FIELDS)[number] | (typeof ATTR_FIELDS)[number];
/** Pole našeho inzerátu → cesty ve feedu (fotky mohou mít víc cest, ostatní první neprázdnou). */
export type FieldMap = Partial<Record<FieldKey, string[]>>;

export const FIELD_LABEL: Record<FieldKey, string> = {
  id: 'ID nabídky', title: 'Název', description: 'Popis', price: 'Cena', currency: 'Měna', url: 'Odkaz na web partnera', images: 'Fotky',
  category: 'Kategorie', city: 'Město / obec', zip: 'PSČ', condition: 'Stav zboží', offer: 'Prodej / pronájem', model: 'Model (do názvu)',
  brand: 'Značka', year: 'Rok výroby', mileage: 'Najeto (km)', fuel: 'Palivo', gearbox: 'Převodovka', body: 'Karoserie', power: 'Výkon',
  layout: 'Dispozice', area: 'Plocha (m²)', ownership: 'Vlastnictví', energy: 'Energetická třída', size: 'Velikost',
};

export const FEED_MAX_IMAGES = 12;

/** Klíč pole pro porovnání: poslední část cesty bez jmenného prostoru, `param:` a diakritiky („param:Rok výroby“ → „rokvyroby“). */
export function fieldKey(path: string): string {
  const last = path.split('/').pop() ?? path;
  return normalizeSearchText(last.replace(/^@/, '').replace(/^param:/, '').replace(/^[A-Za-z]+:/, '')).replace(/[^a-z0-9]/g, '');
}
const parentKey = (path: string) => { const p = path.split('/'); return p.length > 1 ? fieldKey(p[p.length - 2]) : ''; };

/** Názvy polí, podle kterých se přiřazení odhadne (normalizované, v pořadí priority). */
const SYNONYMS: Record<Exclude<FieldKey, 'images'>, string[]> = {
  id: ['itemid', 'id', 'gid', 'idinzeratu', 'externalid', 'sku', 'kod', 'code', 'productno', 'evidencnicislo', 'cislozakazky', 'cislo', 'reference', 'ref', 'guid'],
  title: ['productname', 'nazev', 'title', 'titulek', 'headline', 'name', 'product', 'jmeno'],
  description: ['description', 'popis', 'popisek', 'desc', 'text', 'content', 'summary', 'poznamka', 'detail'],
  price: ['pricevat', 'price', 'cena', 'cenasdph', 'cenakc', 'saleprice', 'cenavcdph', 'amount'],
  currency: ['currency', 'mena', 'currencyid'],
  url: ['url', 'link', 'odkaz', 'detailurl', 'producturl', 'web', 'www'],
  category: ['categorytext', 'kategorie', 'category', 'producttype', 'rubrika', 'druh', 'typnemovitosti', 'typvozidla', 'googleproductcategory', 'sekce'],
  city: ['city', 'mesto', 'obec', 'lokalita', 'location', 'misto', 'town', 'locality'],
  zip: ['zip', 'psc', 'postalcode', 'postcode', 'zipcode'],
  condition: ['condition', 'stav', 'stavzbozi', 'itemcondition', 'itemtype'],
  offer: ['typnabidky', 'offertype', 'transaction', 'typobchodu', 'transakce', 'advertfunction', 'nabidka'],
  model: ['model', 'modelvozu', 'modelvozidla'],
  brand: ['manufacturer', 'znacka', 'vyrobce', 'brand', 'make', 'znackavozu', 'znackavozidla'],
  year: ['rokvyroby', 'rok', 'year', 'modelyear', 'madedate', 'datumvyroby', 'vyrobeno', 'prvniregistrace', 'datumprvniregistrace', 'firstregistration', 'registrace', 'uvedenidoprovozu'],
  mileage: ['najeto', 'najetokm', 'tachometr', 'stavtachometru', 'mileage', 'odometer', 'km'],
  fuel: ['palivo', 'fuel', 'fueltype', 'druhpaliva'],
  gearbox: ['prevodovka', 'gearbox', 'transmission', 'typprevodovky'],
  body: ['karoserie', 'body', 'bodytype', 'bodystyle', 'druhkaroserie', 'typkaroserie'],
  power: ['vykon', 'vykonkw', 'power', 'enginepower', 'kw'],
  layout: ['dispozice', 'layout', 'velikostbytu'],
  area: ['uzitnaplocha', 'plocha', 'plochaobytna', 'podlahovaplocha', 'area', 'floorarea', 'usablearea', 'plochapozemku', 'vymera'],
  ownership: ['vlastnictvi', 'ownership', 'typvlastnictvi'],
  energy: ['energetickatrida', 'penb', 'energyclass', 'energy', 'tridaenergetickenarocnosti', 'energetickanarocnost'],
  size: ['velikost', 'size', 'gsize'],
};
const IMAGE_FIELDS = ['imgurl', 'imgurlalternative', 'imagelink', 'additionalimagelink', 'image', 'images', 'img', 'foto', 'fotka', 'fotografie', 'photo', 'photos', 'picture', 'obrazek', 'imageurl', 'pictureurl'];
const IMAGE_CONTAINERS = new Set(['foto', 'fotky', 'fotografie', 'images', 'image', 'photos', 'photo', 'obrazky', 'obrazek', 'pictures', 'picture', 'gallery', 'galerie', 'imgs']);
const IMAGE_LEAF = new Set(['url', 'src', 'href', 'link', 'text', '']);

const PRESETS: Record<Exclude<FeedFormat, 'generic'>, FieldMap> = {
  heureka: {
    id: ['ITEM_ID'], title: ['PRODUCTNAME', 'PRODUCT'], description: ['DESCRIPTION'], price: ['PRICE_VAT', 'PRICE'], url: ['URL'],
    images: ['IMGURL', 'IMGURL_ALTERNATIVE'], category: ['CATEGORYTEXT'], brand: ['MANUFACTURER'], condition: ['ITEM_TYPE'],
  },
  google: {
    id: ['g:id', 'id'], title: ['g:title', 'title'], description: ['g:description', 'description'], price: ['g:price', 'price'], url: ['g:link', 'link'],
    images: ['g:image_link', 'g:additional_image_link'], category: ['g:product_type', 'g:google_product_category'], brand: ['g:brand'],
    condition: ['g:condition'], size: ['g:size'],
  },
};

const isNumberish = (s: string | undefined) => !!s && Number.isFinite(parseNumber(s));

/**
 * Odhad přiřazení polí: předvolba formátu (jen cesty, které ve feedu jsou) + hledání podle názvů.
 * Ruční přiřazení z administrace (`manual`) má přednost; prázdné pole = „nepoužívat“.
 */
export function suggestFieldMap(format: FeedFormat, fields: FieldInfo[], manual: FieldMap = {}): FieldMap {
  const have = new Set(fields.map((f) => f.path));
  const out: FieldMap = {};
  const used = new Set<string>();
  const take = (k: FieldKey, paths: string[]) => { const p = paths.filter((x) => have.has(x)); if (p.length) { out[k] = p; p.forEach((x) => used.add(x)); } };
  for (const [k, v] of Object.entries(manual) as [FieldKey, string[]][]) if (Array.isArray(v)) { out[k] = v.filter((x) => have.has(x)); v.forEach((x) => used.add(x)); }
  if (format !== 'generic') for (const [k, paths] of Object.entries(PRESETS[format]) as [FieldKey, string[]][]) if (!(k in out)) take(k, paths.filter((p) => have.has(p)).slice(0, k === 'images' ? 9 : 1));

  if (!('images' in out)) {
    const imgs = fields.filter((f) => !used.has(f.path) && (IMAGE_FIELDS.includes(fieldKey(f.path)) || (IMAGE_CONTAINERS.has(parentKey(f.path)) && IMAGE_LEAF.has(fieldKey(f.path))) || (IMAGE_CONTAINERS.has(fieldKey(f.path)) && f.samples.some((s) => /^https?:\/\//i.test(s)))))
      .filter((f) => f.samples.some((s) => /^https?:\/\//i.test(s) || s.includes('/')));
    if (imgs.length) { out.images = imgs.map((f) => f.path); imgs.forEach((f) => used.add(f.path)); }
  }
  for (const k of Object.keys(SYNONYMS) as Exclude<FieldKey, 'images'>[]) {
    if (k in out) continue;
    for (const syn of SYNONYMS[k]) {
      const hit = fields.find((f) => !used.has(f.path) && fieldKey(f.path) === syn
        && !(k === 'url' && IMAGE_CONTAINERS.has(parentKey(f.path)))
        && (!['price', 'year', 'mileage', 'area', 'power'].includes(k) || isNumberish(f.samples[0])));
      if (hit) { out[k] = [hit.path]; used.add(hit.path); break; }
    }
  }
  return out;
}

// ---------- hodnoty ----------

/** Číslo z textu („289 000 Kč“, „1,6“, „125.000 km“ → 125000). NaN, když číslo chybí. */
export function parseNumber(s: string): number {
  const m = /-?\d[\d\s .,]*/.exec(s);
  if (!m) return NaN;
  let t = m[0].replace(/[\s ]/g, '');
  const lastSep = Math.max(t.lastIndexOf(','), t.lastIndexOf('.'));
  if (lastSep >= 0) {
    const decimals = t.length - lastSep - 1;
    // „125.000“ / „1,250,000“ = tisíce; „1234,50“ / „1.6“ = desetinná čárka/tečka
    if (decimals === 3 && (t.match(/[.,]/g)?.length ?? 0) >= 1 && !/^0[.,]/.test(t)) t = t.replace(/[.,]/g, '');
    else t = `${t.slice(0, lastSep).replace(/[.,]/g, '')}.${t.slice(lastSep + 1)}`;
  }
  return Number(t);
}

/** Cena a měna („1 234,50 CZK“, „99 EUR“, „€ 99“). Nula a záporná = neuvedena. */
export function parsePrice(raw: string | undefined, currencyRaw?: string): { price: number | null; currency: 'CZK' | 'EUR' } {
  const text = `${raw ?? ''} ${currencyRaw ?? ''}`;
  const currency = /eur|€/i.test(text) ? 'EUR' : 'CZK';
  const n = raw ? parseNumber(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return { price: null, currency };
  return { price: Math.min(Math.round(n), 2_000_000_000), currency };
}

export type ConditionValue = 'NEW' | 'LIKE_NEW' | 'USED' | 'DAMAGED';
export function parseCondition(raw: string | undefined): ConditionValue | null {
  const s = normalizeSearchText(raw ?? '');
  if (!s) return null;
  if (/poskoz|havar|damaged|nefunk|na dily/.test(s)) return 'DAMAGED';
  if (/jako nov|rozbal|refurb|repas|like new|vystav/.test(s)) return 'LIKE_NEW';
  if (/^(new|nov[eyaá]?)\b|^novy|^nove|^nova/.test(s)) return 'NEW';
  if (/used|pouz|ojet|bazaa?r|second/.test(s)) return 'USED';
  return null;
}

export function parseOffer(raw: string | undefined, text = ''): 'SELL' | 'RENT' {
  const s = normalizeSearchText(raw ?? '');
  if (s) return /pronaj|najem|rent|lease|let\b/.test(s) ? 'RENT' : 'SELL';
  return /\b(k pronajmu|pronajem|pronajmu)\b/.test(normalizeSearchText(text).slice(0, 200)) ? 'RENT' : 'SELL';
}

export interface FeedItem {
  id: string; title: string; description: string; price: number | null; currency: 'CZK' | 'EUR'; url: string | null; images: string[];
  category: string; city: string; zip: string | null; condition: ConditionValue | null; offer: 'SELL' | 'RENT';
  /** Surové hodnoty parametrů (přepočítají se podle kategorie v normalizeAttrs) */
  attrs: Partial<Record<(typeof ATTR_FIELDS)[number], string>>;
}

const first = (item: RawItem, paths: string[] | undefined) => { for (const p of paths ?? []) { const v = item[p]?.find((x) => x.trim()); if (v) return v.trim(); } return undefined; };
const httpUrl = (s: string) => { try { const u = new URL(s.trim()); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.toString() : null; } catch { return null; } };
const shortHash = (s: string) => createHash('sha1').update(s).digest('hex').slice(0, 16);

/** Položka feedu → data inzerátu. Vrací chybu, když položka nejde použít (chybí název apod.). */
export function mapItem(item: RawItem, map: FieldMap, base?: string): { item: FeedItem | null; error?: string } {
  const attrs: FeedItem['attrs'] = {};
  for (const k of ATTR_FIELDS) { const v = first(item, map[k]); if (v) attrs[k] = v.slice(0, 200); }
  const model = first(item, map.model);
  let title = cleanTitle(htmlToText(first(item, map.title) ?? ''));
  if (title.length < 3) title = cleanTitle([attrs.brand, model].filter(Boolean).join(' '));
  if (title.length < 3) return { item: null, error: 'Chybí název nabídky.' };
  let description = htmlToText(first(item, map.description) ?? '');
  if (description.replace(/[\s.•-]/g, '').length < 3) description = title;
  if (description.length > 8000) description = `${description.slice(0, 7990).trimEnd()}…`;
  const resolve = (s: string) => { try { return httpUrl(base ? new URL(s.trim(), base).toString() : s); } catch { return null; } };
  const url = (() => { const v = first(item, map.url); return v ? resolve(v) : null; })();
  const rawId = first(item, map.id);
  const id = rawId ? rawId.slice(0, 120) : url ? `u:${shortHash(url)}` : `t:${shortHash(title)}`;
  const images: string[] = [];
  for (const p of map.images ?? []) for (const v of item[p] ?? []) {
    for (const part of (v.match(/https?:\/\//gi)?.length ?? 0) > 1 ? v.split(/[\s,;|]+/) : [v]) {
      const u = resolve(part);
      if (u && !images.includes(u) && images.length < FEED_MAX_IMAGES) images.push(u);
    }
  }
  const { price, currency } = parsePrice(first(item, map.price), first(item, map.currency));
  const zipRaw = first(item, map.zip)?.replace(/\s/g, '');
  return {
    item: {
      id, title, description, price, currency, url, images,
      category: (first(item, map.category) ?? '').slice(0, 300), city: (first(item, map.city) ?? '').slice(0, 80),
      zip: zipRaw && /^\d{5}$/.test(zipRaw) ? zipRaw : null,
      condition: parseCondition(first(item, map.condition)), offer: parseOffer(first(item, map.offer), `${title}\n${first(item, map.category) ?? ''}`), attrs,
    },
  };
}

/** Otisk dat položky – změní se, když partner nabídku ve feedu upraví. */
export function itemHash(i: FeedItem): string {
  return createHash('sha256').update(JSON.stringify(i)).digest('hex').slice(0, 24);
}

// ---------- parametry kategorie ----------

const nk = (s: string) => normalizeSearchText(s);
const BRAND_ALIASES: Record<string, string> = { vw: 'Volkswagen', mercedes: 'Mercedes-Benz', 'mercedes benz': 'Mercedes-Benz', skoda: 'Škoda' };

function matchOption(raw: string, options: string[] | undefined): string | undefined {
  if (!options?.length) return raw;
  const k = nk(raw);
  return options.find((o) => nk(o) === k) ?? options.find((o) => k.length >= 3 && (nk(o).startsWith(k) || k.startsWith(nk(o))));
}

function yearOf(s: string): number | undefined {
  const m = /\b(19[5-9]\d|20[0-4]\d)\b/.exec(s);
  return m ? Number(m[1]) : undefined;
}

/** Normalizace jedné hodnoty parametru na tvar, který zná náš filtr. */
export function normalizeAttr(key: string, raw: string, def?: FilterDef): AttrValue | undefined {
  const s = nk(raw);
  switch (key) {
    case 'year': return yearOf(raw);
    case 'mileage': case 'area': { const n = parseNumber(raw); return Number.isFinite(n) ? Math.round(n) : undefined; }
    case 'power': {
      const n = parseNumber(raw);
      if (!Number.isFinite(n)) return undefined;
      return Math.round(/\b(hp|ps|k|koni|kon)\b/.test(s) ? n * 0.7355 : n);
    }
    case 'fuel':
      if (/hybrid/.test(s)) return 'Hybrid';
      if (/elektr|electric|\bev\b|bev/.test(s)) return 'Elektro';
      if (/lpg/.test(s)) return 'LPG';
      if (/cng/.test(s)) return 'CNG';
      if (/naft|diesel|tdi|cdi|hdi/.test(s)) return 'Nafta';
      if (/benz|petrol|gasoline|tsi/.test(s)) return 'Benzín';
      return undefined;
    case 'gearbox':
      if (/autom|dsg|cvt|tiptronic/.test(s)) return 'Automatická';
      if (/manu|rucni|mechan/.test(s)) return 'Manuální';
      return undefined;
    case 'body': {
      const rules: [RegExp, string][] = [[/hatch/, 'Hatchback'], [/kombi|combi|wagon|estate|touring|variant/, 'Kombi'], [/suv|teren|offroad|4x4/, 'SUV'],
        [/sedan|limuz/, 'Sedan'], [/mpv|minivan|velkoprostor/, 'MPV'], [/kupe|coupe/, 'Kupé'], [/kabrio|cabrio|roadster|spider/, 'Kabriolet'],
        [/pick ?up/, 'Pick-up'], [/dodav|furgon|skrin|van/, 'Dodávka']];
      return rules.find(([re]) => re.test(s))?.[1];
    }
    case 'brand': {
      const alias = BRAND_ALIASES[s];
      const hit = matchOption(alias ?? raw, def?.options);
      return hit ?? (def?.options?.includes('Jiná') ? 'Jiná' : undefined);
    }
    case 'layout': {
      if (/garson/.test(s)) return '1+kk';
      const m = /(\d)\s*\+\s*(kk|1)/i.exec(raw);
      if (!m) return undefined;
      return Number(m[1]) >= 5 ? '5+ a větší' : `${m[1]}+${m[2].toLowerCase()}`;
    }
    case 'ownership':
      if (/osob/.test(s)) return 'Osobní';
      if (/druz/.test(s)) return 'Družstevní';
      if (/stat|obec/.test(s)) return 'Státní/obecní';
      return undefined;
    case 'energy': { const m = /\b([A-G])\b/.exec(raw.toUpperCase()); return m?.[1]; }
    default: return def?.options?.length ? matchOption(raw, def.options) : raw;
  }
}

/** Parametry položky podle filtrů cílové kategorie (neznámé a neplatné hodnoty se tiše vynechají). */
export function normalizeAttrs(item: Pick<FeedItem, 'attrs' | 'offer'>, defs: FilterDef[]): Record<string, AttrValue> {
  const values: Record<string, unknown> = {};
  for (const d of defs) {
    if (d.key === 'offerType') { values.offerType = item.offer === 'RENT' ? 'Pronájem' : 'Prodej'; continue; }
    const raw = item.attrs[d.key as keyof FeedItem['attrs']];
    if (raw) { const v = normalizeAttr(d.key, raw, d); if (v !== undefined) values[d.key] = v; }
  }
  return cleanParams(defs, values, false).values;
}

// ---------- kategorie ----------

export interface CatRef { id: string; slug: string; name: string; parentSlug: string; parentName: string }

/** Klíčová slova běžných kategorií feedů (autobazary, reality, e-shopy) → naše podkategorie
 *  (adresa hlavní kategorie / zobrazený název podkategorie – název se nemění, i když se změní adresa). */
const CATEGORY_RULES: [RegExp, string][] = [
  [/\b(motocykl|motork|skutr|moped|ctyrkolk)/, 'auto-moto/Motocykly a skútry'],
  [/\b(uzitkov|dodavk|nakladn|truck|tahac|autobus)/, 'auto-moto/Užitkové vozy'],
  [/\b(karavan|obytn|privez|privesy)/, 'auto-moto/Karavany a přívěsy'],
  [/\b(pneu|pneumatik|disky|alu kola|kola a disky)/, 'auto-moto/Pneumatiky a kola'],
  [/\b(nahradni dil|autodil|dily)/, 'auto-moto/Náhradní díly'],
  [/\b(osobni|automobil|ojete vozy|ojeta auta|vozy|auta|car|cars|vehicle)/, 'auto-moto/Osobní automobily'],
  [/\b(garaz|parkovaci stani)/, 'reality/Garáže'],
  [/\b(chata|chaty|chalup|rekreacni)/, 'reality/Chaty a chalupy'],
  [/\b(pozem|parcel|zahrad[ay] k|louk|les\b|orna puda)/, 'reality/Pozemky'],
  [/\b(komercni|kancelar|sklad|obchodni prostor|nebytov|restaurac|hotel|vyrobni)/, 'reality/Komerční prostory'],
  [/\b(rodinn|domy\b|dum\b|domu\b|domek|vila|vily|radov)/, 'reality/Domy'],
  [/\b(byt|byty|apartman|garsonier)/, 'reality/Byty na prodej'],
];

/** Odhad naší podkategorie podle textu kategorie feedu (a parametrů). null = nevíme, použije se výchozí kategorie feedu. */
export function suggestCategory(text: string, cats: CatRef[], hints: { offer?: 'SELL' | 'RENT'; attrs?: FeedItem['attrs'] } = {}): CatRef | null {
  const byName = (s: string) => cats.find((c) => `${c.parentSlug}/${c.name}` === s) ?? null;
  const rent = (c: CatRef | null) => (c && c.parentSlug === 'reality' && c.name === 'Byty na prodej' && hints.offer === 'RENT' ? byName('reality/Byty k pronájmu') ?? c : c);
  const segments = text.split(/\s*(?:\||>|›|»|\/|;|\\)\s*/).map(nk).filter(Boolean);
  // 1) přesná shoda názvu podkategorie (od nejkonkrétnější části)
  for (const seg of [...segments].reverse()) {
    const hit = cats.find((c) => nk(c.name) === seg || c.slug.replace(/-/g, ' ') === seg);
    if (hit) return rent(hit);
  }
  // 2) klíčová slova (autobazary, reality)
  const full = ` ${segments.join(' ')} `;
  for (const [re, target] of CATEGORY_RULES) if (re.test(full)) return rent(byName(target));
  // 3) shoda slov (kmen 5 znaků) s názvem podkategorie, nejkonkrétnější část má přednost
  const stems = (s: string) => s.split(' ').filter((w) => w.length >= 4).map((w) => w.slice(0, 5));
  for (const seg of [...segments].reverse()) {
    const words = stems(seg);
    if (!words.length) continue;
    let best: { c: CatRef; score: number } | null = null;
    for (const c of cats) {
      const own = stems(nk(c.name));
      const score = words.filter((w) => own.includes(w)).length;
      if (score && (!best || score > best.score)) best = { c, score };
    }
    if (best) return rent(best.c);
  }
  // 4) podle parametrů: auto / nemovitost
  const a = hints.attrs ?? {};
  if (a.brand && (a.mileage || a.fuel || a.gearbox)) return byName('auto-moto/Osobní automobily');
  if (a.layout || (a.area && a.ownership)) return rent(byName('reality/Byty na prodej'));
  return null;
}
