/**
 * Všechny obce ČR (a krajská města SR) s krajem, okresem, PSČ a souřadnicemi.
 * Soubor je velký (~250 kB), proto NENÍ exportován z index.ts a používá se jen na serveru:
 * import { … } from '@dej/shared/dist/municipalities'.
 */
import { CITIES, REGIONS } from './locations';
import { MUNICIPALITIES_RAW, OKRESY } from './municipalities-data';
import { normalizeSearchText } from './search-text';

export interface Municipality {
  name: string;
  /** Okres (u SR krajské město) */
  district: string;
  /** Kód kraje – REGIONS.code */
  region: string;
  zip: string;
  lat: number;
  lng: number;
  country: 'CZ' | 'SK';
}

export interface MunicipalitySuggestion extends Municipality {
  /** Text pro zobrazení, u nejednoznačných názvů s okresem: „Adamov (okres Blansko)“ */
  label: string;
  regionName: string;
}

let ALL: Municipality[] | undefined;
let BY_NAME: Map<string, Municipality[]> | undefined;
let BY_ZIP: Map<string, Municipality[]> | undefined;

const key = (s: string) => normalizeSearchText(s);

function load() {
  if (ALL) return;
  ALL = MUNICIPALITIES_RAW.split('\n').map((line) => {
    const [name, oi, region, zip, lat, lng] = line.split('|');
    return { name, district: OKRESY[Number(oi)], region, zip, lat: Number(lat), lng: Number(lng), country: 'CZ' as const };
  });
  for (const c of CITIES) {
    if (REGIONS.find((r) => r.code === c.region)?.country === 'SK') ALL.push({ name: c.name, district: c.name, region: c.region, zip: c.zip, lat: c.lat, lng: c.lng, country: 'SK' });
  }
  BY_NAME = new Map();
  BY_ZIP = new Map();
  for (const m of ALL) {
    const k = key(m.name);
    BY_NAME.set(k, [...(BY_NAME.get(k) ?? []), m]);
    BY_ZIP.set(m.zip, [...(BY_ZIP.get(m.zip) ?? []), m]);
  }
}

export function allMunicipalities(): Municipality[] { load(); return ALL!; }

const cleanZip = (zip?: string | null) => { const z = (zip ?? '').replace(/\s/g, ''); return /^\d{5}$/.test(z) ? z : undefined; };

/** Seřadí obce stejného jména: shoda okresu, shoda PSČ, okresní město, pak podle PSČ nejblíže. */
function pick(cands: Municipality[], district?: string, zip?: string): Municipality {
  if (cands.length === 1) return cands[0];
  const d = district ? key(district) : undefined;
  const score = (m: Municipality) =>
    (d && key(m.district) === d ? 1000 : 0) + (zip && m.zip === zip ? 500 : 0) + (zip && m.zip.slice(0, 3) === zip.slice(0, 3) ? 200 : 0)
    + (zip && m.zip[0] === zip[0] ? 50 : 0) + (key(m.district) === key(m.name) ? 100 : 0);
  return [...cands].sort((a, b) => score(b) - score(a))[0];
}

/** Obec podle PSČ: přesná shoda, jinak nejbližší PSČ se stejným začátkem (pošta ve stejné oblasti). */
export function municipalityByZip(zip: string): Municipality | undefined {
  load();
  const z = cleanZip(zip);
  if (!z) return undefined;
  const exact = BY_ZIP!.get(z);
  if (exact) return pick(exact);
  // Praha má jediné PSČ v datech, ale všechna pražská PSČ začínají 1
  if (z[0] === '1') return BY_NAME!.get('praha')?.[0];
  let best: Municipality | undefined; let diff = Infinity;
  for (const m of ALL!) {
    if (m.country !== 'CZ' || m.zip.slice(0, 3) !== z.slice(0, 3)) continue;
    const dd = Math.abs(Number(m.zip) - Number(z));
    if (dd < diff) { diff = dd; best = m; }
  }
  return best;
}

/**
 * Najde obec podle názvu (bez ohledu na diakritiku a velikost písmen).
 * Rozumí i „Adamov (okres Blansko)“, „Praha 4“, „Brno-Líšeň“. Nejednoznačné názvy rozliší okres nebo PSČ.
 */
export function findMunicipality(name: string, zip?: string | null): Municipality | undefined {
  load();
  const z = cleanZip(zip);
  let text = name.trim();
  let district: string | undefined;
  const m = text.match(/^(.*?)\s*\((?:okres\s+)?([^)]+)\)\s*$/i);
  if (m) { text = m[1]; district = m[2]; }
  const k = key(text);
  if (!k) return undefined;
  const direct = BY_NAME!.get(k);
  if (direct) return pick(direct, district, z);
  // Část obce: „Praha 4“, „Praha-Chodov“, „Brno - Líšeň“, „Ostrava, Poruba“
  const base = text.split(/\s*[-,–]\s*|\s+\d+\s*$/)[0];
  const bk = key(base);
  if (bk && bk !== k) {
    const b = BY_NAME!.get(bk);
    if (b) return pick(b, district, z);
  }
  const noDigits = key(text.replace(/\s+\d+.*$/, ''));
  if (noDigits && noDigits !== k) { const b = BY_NAME!.get(noDigits); if (b) return pick(b, district, z); }
  return undefined;
}

export interface ResolvedLocation {
  /** Úplný název obce, nebo text uživatele, když obec nepoznáme */
  city: string;
  region: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  /** Jak jsme polohu určili */
  matched: 'name' | 'zip' | 'none';
}

/**
 * Lokalita inzerátu: obec podle názvu (PSČ pomůže s nejednoznačností), jinak poloha podle PSČ.
 * PSČ zadané uživatelem má přednost, jinak se doplní PSČ obce.
 */
export function resolveLocation(city: string, zip?: string | null): ResolvedLocation {
  const z = cleanZip(zip) ?? null;
  const byName = findMunicipality(city, z);
  if (byName) return { city: byName.name, region: byName.region, zip: z ?? byName.zip, lat: byName.lat, lng: byName.lng, matched: 'name' };
  const byZip = z ? municipalityByZip(z) : undefined;
  if (byZip) return { city: city.trim(), region: byZip.region, zip: z, lat: byZip.lat, lng: byZip.lng, matched: 'zip' };
  return { city: city.trim(), region: '', zip: z, lat: null, lng: null, matched: 'none' };
}

function toSuggestion(m: Municipality): MunicipalitySuggestion {
  load();
  const dup = (BY_NAME!.get(key(m.name))?.length ?? 0) > 1;
  return { ...m, label: dup ? `${m.name} (okres ${m.district})` : m.name, regionName: REGIONS.find((r) => r.code === m.region)?.name ?? m.region };
}

/** Našeptávač obcí: podle začátku názvu, slova v názvu nebo PSČ. */
export function suggestMunicipalities(q: string, limit = 8): MunicipalitySuggestion[] {
  load();
  const digits = q.replace(/\s/g, '');
  if (/^\d{2,5}$/.test(digits)) {
    const hits = ALL!.filter((m) => m.zip.startsWith(digits));
    if (!hits.length && digits.length === 5) { const z = municipalityByZip(digits); return z ? [toSuggestion(z)] : []; }
    return hits.sort((a, b) => a.zip.localeCompare(b.zip)).slice(0, limit).map(toSuggestion);
  }
  const k = key(q);
  if (k.length < 2) return [];
  const scored: [number, Municipality][] = [];
  for (const m of ALL!) {
    const n = key(m.name);
    let s = -1;
    if (n === k) s = 0;
    else if (n.startsWith(k)) s = 1;
    else if (n.includes(` ${k}`)) s = 2;
    if (s < 0) continue;
    // okresní a krajská města (název = okres) a krátké názvy dopředu
    const seat = key(m.district) === n ? 0 : 1;
    scored.push([s * 10 + seat * 5 + Math.min(4, Math.floor(n.length / 6)), m]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, 'cs')).slice(0, limit).map(([, m]) => toSuggestion(m));
}

/** Nejbližší obec k zadaným souřadnicím (pro „Moje poloha“). */
export function nearestMunicipality(lat: number, lng: number): Municipality | undefined {
  load();
  let best: Municipality | undefined; let bd = Infinity;
  const cos = Math.cos((lat * Math.PI) / 180);
  for (const m of ALL!) {
    const d = (m.lat - lat) ** 2 + ((m.lng - lng) * cos) ** 2;
    if (d < bd) { bd = d; best = m; }
  }
  return best;
}
