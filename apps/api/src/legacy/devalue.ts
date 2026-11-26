/**
 * Čtení dat starého webu www.dejinzerat.cz (SvelteKit). Jeho `__data.json` je ve formátu „devalue“:
 * všechny hodnoty leží v jednom poli a objekty na sebe odkazují indexy. Tady je převedeme zpět na běžné objekty.
 * Data jsou cizí vstup – žádný kód se nespouští, neznámé typy se vrátí jako null.
 */

const HOLE = -2;
const UNDEFINED = -1;

export function unflatten(values: unknown): unknown {
  if (typeof values === 'number') return values === UNDEFINED || values === HOLE ? null : values;
  if (!Array.isArray(values) || values.length === 0) return null;
  const cache = new Map<number, unknown>();
  const get = (i: number, depth: number): unknown => {
    if (i === UNDEFINED || i === HOLE) return null;
    if (!Number.isInteger(i) || i < 0 || i >= values.length) return null;
    if (cache.has(i)) return cache.get(i);
    if (depth > 200) return null;
    const v = values[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === 'string') {
        // Speciální typy: ["Date", "2026-…"], ["Set", …], ["Map", …], ["null", …] (objekt bez prototypu)…
        const [type] = v;
        if (type === 'Date') { const d = new Date(String(v[1])); cache.set(i, d); return d; }
        if (type === 'null') {
          const o: Record<string, unknown> = {};
          cache.set(i, o);
          for (let k = 1; k + 1 < v.length; k += 2) o[String(v[k])] = get(v[k + 1] as number, depth + 1);
          return o;
        }
        cache.set(i, null);
        return null;
      }
      const arr: unknown[] = [];
      cache.set(i, arr);
      for (const x of v) arr.push(typeof x === 'number' ? get(x, depth + 1) : null);
      return arr;
    }
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {};
      cache.set(i, o);
      for (const [k, x] of Object.entries(v)) o[k] = typeof x === 'number' ? get(x, depth + 1) : null;
      return o;
    }
    cache.set(i, v);
    return v;
  };
  return get(0, 0);
}

/** Odpověď `__data.json` → data jednotlivých uzlů stránky (layout, stránka…). */
export function parseSvelteKitData(json: unknown): unknown[] {
  const nodes = (json as { nodes?: unknown[] } | null)?.nodes;
  if (!Array.isArray(nodes)) throw new Error('Neočekávaná odpověď starého webu (chybí nodes).');
  return nodes.map((n) => {
    const node = n as { type?: string; data?: unknown } | null;
    return node?.type === 'data' ? unflatten(node.data) : null;
  });
}

/** První uzel stránky, který má daný klíč (např. „inzeraty“ nebo „inzerat“). */
export function findNode<T>(nodes: unknown[], key: string): T | undefined {
  for (const n of nodes) if (n && typeof n === 'object' && key in n) return (n as Record<string, T>)[key];
  return undefined;
}
