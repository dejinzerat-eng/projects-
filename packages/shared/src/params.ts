import { CATEGORIES, type FilterDef } from './categories';

/** Bezpečné převzetí definic filtrů z databáze (Category.filters je JSON spravovaný v administraci). */
export function asFilterDefs(raw: unknown): FilterDef[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((f): f is FilterDef =>
    !!f && typeof f === 'object' && typeof (f as FilterDef).key === 'string' && !!(f as FilterDef).key && typeof (f as FilterDef).label === 'string'
    && ['select', 'multiselect', 'range', 'boolean'].includes((f as FilterDef).type));
}

/**
 * Parametry platné pro podkategorii podle databáze: filtry rodiče + vlastní filtry podkategorie
 * (stejný klíč v podkategorii přepíše rodiče). Podkategorie, které ve výchozím stromu
 * výslovně parametry nemají (např. Náhradní díly), zdědí jen svoje vlastní.
 */
export function effectiveFilters(parentSlug: string, parentFilters: unknown, subSlug: string, subFilters: unknown): FilterDef[] {
  const own = asFilterDefs(subFilters);
  const parent = asFilterDefs(parentFilters);
  const staticSub = CATEGORIES.find((c) => c.slug === parentSlug)?.children.find((s) => s.slug === subSlug);
  // Výchozí strom říká „bez parametrů rodiče“ (filters: []) – platí jen vlastní parametry z administrace
  if (staticSub?.filters && staticSub.filters.length === 0) return own;
  const ownKeys = new Set(own.map((f) => f.key));
  return [...parent.filter((f) => !ownKeys.has(f.key)), ...own];
}

export type AttrValue = string | number | boolean | string[];

/**
 * Ověří a vyčistí parametry inzerátu podle definic kategorie.
 * Neznámé klíče zahodí. V režimu `strict` vrátí chybu u neplatné hodnoty, jinak ji tiše vynechá (koncept).
 */
export function cleanParams(defs: FilterDef[], attrs: Record<string, unknown>, strict = true): { values: Record<string, AttrValue>; error: string | null } {
  const values: Record<string, AttrValue> = {};
  let error: string | null = null;
  const fail = (d: FilterDef, msg: string) => { if (strict && !error) error = `${d.label}: ${msg}`; };
  for (const d of defs) {
    const v = attrs[d.key];
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
    if (d.type === 'range') {
      const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(/\s/g, '').replace(',', '.')) : NaN;
      if (!Number.isFinite(n)) { fail(d, 'zadejte číslo.'); continue; }
      if (d.min != null && n < d.min) { fail(d, `nejméně ${d.min}${d.unit ? ` ${d.unit}` : ''}.`); continue; }
      if (d.max != null && n > d.max) { fail(d, `nejvýše ${d.max}${d.unit ? ` ${d.unit}` : ''}.`); continue; }
      values[d.key] = n;
    } else if (d.type === 'boolean') {
      if (v === true || v === 'true') values[d.key] = true;
      else if (!(v === false || v === 'false')) fail(d, 'neplatná hodnota.');
    } else if (d.type === 'multiselect') {
      const arr = (Array.isArray(v) ? v : [v]).map(String);
      const ok = arr.filter((x) => !d.options?.length || d.options.includes(x));
      if (ok.length !== arr.length) fail(d, 'vyberte z nabídky.');
      if (ok.length) values[d.key] = ok.length === 1 ? ok[0] : ok;
    } else {
      const s = String(Array.isArray(v) ? v[0] : v);
      if (d.options?.length && !d.options.includes(s)) { fail(d, 'vyberte z nabídky.'); continue; }
      values[d.key] = s.slice(0, 120);
    }
  }
  return { values, error };
}
