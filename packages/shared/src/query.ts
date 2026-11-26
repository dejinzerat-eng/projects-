import { CATEGORIES } from './categories';
import { CITIES, normalize } from './locations';

/** Parametry hledání – sdílené mezi webem, API a uloženými hledáními. */
export interface SearchParams {
  q?: string;
  category?: string;
  sub?: string;
  priceMin?: number;
  priceMax?: number;
  city?: string;
  region?: string;
  radius?: number;
  /** Poloha uživatele (tlačítko „Moje poloha“) – má přednost před městem */
  lat?: number;
  lng?: number;
  /** Typ prodejce: soukromá osoba / firma */
  sellerType?: 'private' | 'business';
  condition?: string[];
  offerType?: string;
  verified?: boolean;
  since?: '24h' | '7d' | '30d';
  sort?: 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'distance';
  attrs?: Record<string, string | string[] | { min?: number; max?: number } | boolean>;
  page?: number;
}

export interface ParsedQuery {
  params: SearchParams;
  /** Lidsky čitelné rozpoznané podmínky, např. ["do 15 000 Kč", "Praha"] */
  recognized: string[];
}

const num = (s: string) => {
  let v = s.replace(/\s| /g, '').replace(',', '.').toLowerCase();
  let mult = 1;
  if (/(tis\.?|tisíc|tisic|k)$/.test(v)) { mult = 1000; v = v.replace(/(tis\.?|tisíc|tisic|k)$/, ''); }
  else if (/(mil|m)$/.test(v)) { mult = 1_000_000; v = v.replace(/(mil\.?|m)$/, ''); }
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * mult) : undefined;
};

const NUM = '(\\d[\\d\\s\\u00a0.,]*(?:\\s?(?:tisíc|tisic|tis\\.?|k|mil\\.?))?)';
const CUR = '(?:\\s?(?:kč|kc|czk|,-|korun|€|eur))?';

/**
 * Rozpozná z přirozeného textu cenu, lokalitu, stav a kategorii.
 * „iPhone 15 Pro do 15 000 Kč Praha“ → q=„iPhone 15 Pro“, priceMax=15000, city=Praha.
 */
export function parseNaturalQuery(input: string): ParsedQuery {
  let text = ` ${input} `;
  const params: SearchParams = {};
  const recognized: string[] = [];
  const fmt = (n: number) => new Intl.NumberFormat('cs-CZ').format(n);

  const range = new RegExp(`\\s(?:od\\s)?${NUM}\\s?(?:-|–|až|do)\\s?${NUM}${CUR}(?=\\s)`, 'i');
  const max = new RegExp(`\\s(?:do|max\\.?|maximálně|pod|levnější než)\\s${NUM}${CUR}(?=\\s)`, 'i');
  const min = new RegExp(`\\s(?:od|min\\.?|minimálně|nad)\\s${NUM}${CUR}(?=\\s)`, 'i');

  let m = text.match(range);
  if (m && /kč|kc|czk|€|eur|tis|k\b|,-/i.test(m[0])) {
    params.priceMin = num(m[1]); params.priceMax = num(m[2]);
    text = text.replace(m[0], ' ');
    recognized.push(`${fmt(params.priceMin!)}–${fmt(params.priceMax!)} Kč`);
  }
  m = text.match(max);
  if (m) { params.priceMax = num(m[1]); text = text.replace(m[0], ' '); recognized.push(`do ${fmt(params.priceMax!)} Kč`); }
  m = text.match(min);
  if (m) { params.priceMin = num(m[1]); text = text.replace(m[0], ' '); recognized.push(`od ${fmt(params.priceMin!)} Kč`); }

  // Lokalita: hledáme nejdelší shodu názvu města (bez diakritiky), volitelně s předložkou „v/ve/u“
  const norm = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const cities = [...CITIES].sort((a, b) => b.name.length - a.name.length);
  for (const c of cities) {
    const cn = normalize(c.name);
    // jednoduché skloňování: „Brno“ → „v Brně“, „Praha“ → „v Praze“ (kmen bez koncové samohlásky)
    const stem = cn.length >= 4 ? cn.replace(/[aeiouy]$/, '') : cn;
    const alt = stem.endsWith('h') ? `(?:${stem}|${stem.slice(0, -1)}z)` : stem;
    const re = new RegExp(`\\s(?:(?:v|ve|u|okoli|z|ze)\\s)?${alt.replace(/[-]/g, '[- ]')}[a-z]{0,3}(?=\\s)`);
    const cm = norm.match(re);
    if (cm && cm.index !== undefined) {
      params.city = c.name;
      text = text.slice(0, cm.index) + ' ' + text.slice(cm.index + cm[0].length);
      recognized.push(c.name);
      break;
    }
  }

  // Stav zboží
  const conditions: [RegExp, string, string][] = [
    [/\s(?:nový|nová|nové|nerozbalen[ýáé]|zabalen[ýáé])(?=\s)/i, 'NEW', 'Nové'],
    [/\s(?:jako nov[ýáé])(?=\s)/i, 'LIKE_NEW', 'Jako nové'],
    [/\s(?:použit[ýáé]|bazar(?:ov[ýáé])?)(?=\s)/i, 'USED', 'Použité'],
    [/\s(?:na díly|poškozen[ýáé]|rozbit[ýáé]|nefunkční)(?=\s)/i, 'DAMAGED', 'Poškozené'],
  ];
  for (const [re, val, label] of conditions) {
    const cm = text.match(re);
    if (cm) { params.condition = [val]; text = text.replace(cm[0], ' '); recognized.push(label); break; }
  }

  // Typ nabídky
  if (/\s(?:daruji|zdarma|za odvoz)(?=\s)/i.test(text)) { params.offerType = 'GIVE'; recognized.push('Zdarma'); text = text.replace(/\s(?:daruji|zdarma|za odvoz)(?=\s)/i, ' '); }
  if (/\s(?:pronájem|pronajmu|k pronájmu)(?=\s)/i.test(text)) { params.offerType = 'RENT'; recognized.push('Pronájem'); text = text.replace(/\s(?:pronájem|pronajmu|k pronájmu)(?=\s)/i, ' '); }

  // Kategorie: přímá shoda s názvem podkategorie (např. „byty“, „kočárky“)
  const tn = ` ${normalize(text)} `;
  outer: for (const cat of CATEGORIES) {
    for (const sub of cat.children) {
      const sn = normalize(sub.name);
      if (sn.length > 3 && tn.includes(` ${sn} `)) {
        params.category = cat.slug; params.sub = sub.slug; recognized.push(sub.name);
        text = text.replace(new RegExp(`\\s${sub.name}(?=\\s)`, 'i'), ' ');
        break outer;
      }
    }
  }

  const q = text.replace(/\s+/g, ' ').trim();
  if (q) params.q = q;
  return { params, recognized };
}

/** Serializace parametrů do URL (pro odkazy a uložená hledání). */
export function toSearchString(p: SearchParams): string {
  const u = new URLSearchParams();
  const set = (k: string, v: unknown) => { if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) u.set(k, Array.isArray(v) ? v.join(',') : String(v)); };
  set('q', p.q); set('kategorie', p.category); set('pod', p.sub);
  set('cena_od', p.priceMin); set('cena_do', p.priceMax);
  set('mesto', p.city); set('kraj', p.region); set('okruh', p.radius);
  if (p.lat != null && p.lng != null) { set('lat', Number(p.lat).toFixed(4)); set('lng', Number(p.lng).toFixed(4)); }
  set('prodejce', p.sellerType === 'private' ? 'soukromy' : p.sellerType === 'business' ? 'firma' : undefined);
  set('stav', p.condition); set('typ', p.offerType); set('overeny', p.verified ? '1' : undefined);
  set('od', p.since); set('razeni', p.sort && p.sort !== 'relevance' ? p.sort : undefined);
  if (p.attrs) {
    for (const [k, v] of Object.entries(p.attrs)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) { set(`p_${k}_od`, v.min); set(`p_${k}_do`, v.max); }
      else if (typeof v === 'boolean') set(`p_${k}`, v ? '1' : undefined);
      else set(`p_${k}`, v);
    }
  }
  set('strana', p.page && p.page > 1 ? p.page : undefined);
  return u.toString();
}

/**
 * Klíč uloženého hledání: stejné podmínky = stejný klíč. Bez stránky a řazení; nezáleží na pořadí parametrů,
 * hodnot ve vícenásobném výběru ani na velikosti písmen a mezerách v hledaném textu.
 */
export function savedSearchKey(p: SearchParams): string {
  const { page: _p, sort: _s, ...rest } = p;
  const sorted = <T,>(v: T): T => (Array.isArray(v) ? ([...v].map(String).sort() as T) : v);
  // Uložený JSON nemusí mít přesný tvar (starší záznamy, ruční volání API) – text bereme jen jako řetězec
  const q = typeof rest.q === 'string' ? rest.q.replace(/\s+/g, ' ').trim().toLowerCase() || undefined : undefined;
  const attrs = rest.attrs && typeof rest.attrs === 'object' ? Object.fromEntries(Object.entries(rest.attrs).map(([k, v]) => [k, sorted(v)])) : undefined;
  const u = new URLSearchParams(toSearchString({ ...rest, q, condition: sorted(rest.condition), attrs }));
  u.sort();
  return u.toString();
}

/** Souřadnice z URL jen tehdy, když jsou obě platné. */
function geoParams(lat?: number, lng?: number): Pick<SearchParams, 'lat' | 'lng'> {
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return {};
  return { lat, lng };
}

export function fromSearchString(input: URLSearchParams | Record<string, string | string[] | undefined>): SearchParams {
  const get = (k: string): string | undefined => {
    if (input instanceof URLSearchParams) return input.get(k) ?? undefined;
    const v = input[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const keys = input instanceof URLSearchParams ? [...input.keys()] : Object.keys(input);
  const n = (k: string) => { const v = get(k); if (v === undefined || v === '') return undefined; const x = Number(v); return Number.isFinite(x) ? x : undefined; };
  const p: SearchParams = {
    q: get('q') || undefined,
    category: get('kategorie') || undefined,
    sub: get('pod') || undefined,
    priceMin: n('cena_od'), priceMax: n('cena_do'),
    city: get('mesto') || undefined, region: get('kraj') || undefined, radius: n('okruh'),
    ...geoParams(n('lat'), n('lng')),
    sellerType: get('prodejce') === 'firma' ? 'business' : get('prodejce') === 'soukromy' ? 'private' : undefined,
    condition: get('stav')?.split(',').filter(Boolean),
    offerType: get('typ') || undefined,
    verified: get('overeny') === '1' || undefined,
    since: (get('od') as SearchParams['since']) || undefined,
    sort: (get('razeni') as SearchParams['sort']) || undefined,
    page: n('strana'),
  };
  const attrs: NonNullable<SearchParams['attrs']> = {};
  for (const k of keys) {
    if (!k.startsWith('p_')) continue;
    const rm = k.match(/^p_(.+)_(od|do)$/);
    if (rm) {
      const cur = (attrs[rm[1]] as { min?: number; max?: number }) || {};
      cur[rm[2] === 'od' ? 'min' : 'max'] = n(k);
      attrs[rm[1]] = cur;
    } else {
      const v = get(k)!;
      attrs[k.slice(2)] = v === '1' ? true : v.includes(',') ? v.split(',') : v;
    }
  }
  if (Object.keys(attrs).length) p.attrs = attrs;
  return p;
}
