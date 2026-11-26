/**
 * Čtení XML feedů partnerů (bez sítě a databáze – čisté funkce, testy v feed-parse.spec.ts).
 *
 * Podporované formáty:
 * - Heureka / Zboží.cz (SHOP › SHOPITEM, PARAM › PARAM_NAME + VAL) – běžný export e-shopů (Shoptet, Upgates…),
 * - Google Merchant (RSS item / Atom entry s poli g:id, g:price…),
 * - libovolné jiné XML (autobazary, realitní software, vlastní export „Dejinzerat XML“): opakující se položka
 *   se najde sama a pole se přiřadí podle názvů (feed-map.ts), v administraci je lze přiřadit ručně.
 *
 * Každá položka se převede na plochý seznam polí „cesta → hodnoty“ (např. `IMGURL`, `foto/@url`, `param:Rok výroby`).
 */
import { XMLParser } from 'fast-xml-parser';

export type FeedFormat = 'heureka' | 'google' | 'generic';
export const FEED_FORMATS: FeedFormat[] = ['heureka', 'google', 'generic'];

/** Položka feedu: cesta pole → hodnoty (pole se může opakovat, např. fotky). */
export type RawItem = Record<string, string[]>;
export interface FieldInfo { path: string; count: number; samples: string[] }
export interface ParsedFeed { format: FeedFormat; itemTag: string; items: RawItem[]; total: number; fields: FieldInfo[] }

const MAX_VALUES_PER_FIELD = 40;
const MAX_VALUE_LENGTH = 20_000;

/** Bajty feedu → text podle BOM nebo deklarace `encoding` (UTF-8, windows-1250, ISO-8859-2…). */
export function decodeXml(buf: Buffer): string {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  const head = buf.subarray(0, 300).toString('latin1');
  const enc = /<\?xml[^>]*encoding\s*=\s*["']([\w.:-]+)["']/i.exec(head)?.[1]?.toLowerCase();
  if (enc && enc !== 'utf-8' && enc !== 'utf8') {
    try { return new TextDecoder(enc).decode(buf); } catch { /* neznámé kódování – zkusíme UTF-8 */ }
  }
  return buf.toString('utf8');
}

/** Názvy elementů, které obvykle znamenají jednu nabídku (pomáhají, když má feed jen jednu položku). */
const ITEM_TAGS = new Set([
  'shopitem', 'item', 'entry', 'inzerat', 'nabidka', 'offer', 'vehicle', 'car', 'auto', 'vozidlo', 'vuz', 'property', 'nemovitost',
  'listing', 'advert', 'ad', 'product', 'produkt', 'zakazka', 'estate', 'realty', 'zbozi', 'polozka',
]);

const bare = (k: string) => k.replace(/^[\w-]+:/, '').toLowerCase();

type Node = Record<string, unknown>;
const isObj = (v: unknown): v is Node => !!v && typeof v === 'object' && !Array.isArray(v);

/** Najde opakující se element s nabídkami. Prochází jen objekty (ne uvnitř položek), aby nevybral např. PARAM. */
function findItems(root: Node): { tag: string; items: Node[] } | null {
  const found: { tag: string; items: Node[]; depth: number; known: boolean }[] = [];
  const walk = (node: Node, depth: number) => {
    if (depth > 6) return;
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('@') || k === '#text') continue;
      const known = ITEM_TAGS.has(bare(k));
      if (Array.isArray(v)) {
        const objs = v.filter(isObj);
        if (objs.length) found.push({ tag: k, items: objs, depth, known });
      } else if (isObj(v)) {
        if (known) found.push({ tag: k, items: [v], depth, known });
        else walk(v, depth + 1);
      }
    }
  };
  walk(root, 0);
  if (!found.length) return null;
  const pool = found.some((f) => f.known) ? found.filter((f) => f.known) : found;
  pool.sort((a, b) => b.items.length - a.items.length || a.depth - b.depth);
  return pool[0];
}

const NAME_KEYS = new Set(['param_name', 'name', 'nazev', 'název', 'key', 'klic', 'attribute_name', 'n', 'label']);
const VALUE_KEYS = new Set(['val', 'value', 'hodnota', '#text', 'attribute_value', 'v']);

/** Dvojice název + hodnota (`<PARAM><PARAM_NAME>Barva</PARAM_NAME><VAL>modrá</VAL></PARAM>`, `<parametr nazev="Rok">2018</parametr>`). */
function paramPair(node: Node): { name: string; value: string } | null {
  const keys = Object.keys(node);
  if (keys.length > 4) return null;
  let name: string | undefined;
  let value: string | undefined;
  for (const k of keys) {
    const b = bare(k.replace(/^@/, ''));
    const v = node[k];
    if (typeof v !== 'string' && typeof v !== 'number') continue;
    if (k !== '#text' && NAME_KEYS.has(b) && name === undefined) name = String(v);
    else if (VALUE_KEYS.has(k === '#text' ? '#text' : b) && value === undefined) value = String(v);
  }
  return name?.trim() && value !== undefined ? { name: name.trim().slice(0, 80), value } : null;
}

/** Položka → plochý seznam polí. */
export function flattenItem(node: Node): RawItem {
  const out: RawItem = {};
  const push = (path: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    const list = (out[path] ??= []);
    if (list.length < MAX_VALUES_PER_FIELD) list.push(v.slice(0, MAX_VALUE_LENGTH));
  };
  const walk = (v: unknown, prefix: string, depth: number) => {
    if (v == null || depth > 8) return;
    if (Array.isArray(v)) { for (const x of v) walk(x, prefix, depth); return; }
    if (!isObj(v)) { push(prefix || '#text', String(v)); return; }
    const pair = paramPair(v);
    if (pair) { push(`param:${pair.name}`, pair.value); return; }
    for (const [k, x] of Object.entries(v)) {
      if (k === '#text') push(prefix || '#text', String(x));
      else walk(x, prefix ? `${prefix}/${k}` : k, depth + 1);
    }
  };
  walk(node, '', 0);
  return out;
}

function detectFormat(tag: string, items: RawItem[]): FeedFormat {
  if (bare(tag) === 'shopitem') return 'heureka';
  if (items.slice(0, 20).some((i) => 'g:id' in i || 'g:price' in i)) return 'google';
  return 'generic';
}

/** Přehled polí pro přiřazení v administraci (počet položek, ve kterých pole je, a ukázky hodnot). */
export function describeFields(items: RawItem[]): FieldInfo[] {
  const map = new Map<string, FieldInfo>();
  for (const it of items) {
    for (const [path, values] of Object.entries(it)) {
      const f = map.get(path) ?? { path, count: 0, samples: [] };
      f.count++;
      for (const v of values) if (f.samples.length < 3 && !f.samples.includes(v.slice(0, 80))) f.samples.push(v.slice(0, 80));
      map.set(path, f);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

export class FeedParseError extends Error {}

/** Celý feed: text XML → položky. `limit` = nejvýše tolik položek (zbytek se jen spočítá). */
export function parseFeed(xml: string, limit = 10_000): ParsedFeed {
  // DOCTYPE vynecháme (vlastní entity = riziko „billion laughs“, externí entity nikdy nečteme)
  const clean = xml.replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/i, '');
  const head = clean.slice(0, 5000);
  if (!/<[A-Za-z_][\w:.-]*[\s>/]/.test(head)) throw new FeedParseError('Na adrese není XML (zkontrolujte odkaz na feed).');
  if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(!doctype\s+html|html)[\s>]/i.test(head)) throw new FeedParseError('Na adrese je webová stránka (HTML), ne XML feed. Zkontrolujte odkaz na feed.');
  const parser = new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', parseTagValue: false, parseAttributeValue: false,
    trimValues: true, processEntities: true, htmlEntities: true, ignoreDeclaration: true, ignorePiTags: true,
  });
  let root: unknown;
  try { root = parser.parse(clean, true); } catch (e) { throw new FeedParseError(`Feed není platné XML: ${(e as Error).message.slice(0, 200)}`); }
  if (!isObj(root)) throw new FeedParseError('Feed je prázdný.');
  const hit = findItems(root);
  if (!hit) throw new FeedParseError('Ve feedu jsme nenašli žádné nabídky (opakující se položky).');
  const items = hit.items.slice(0, limit).map(flattenItem);
  return { format: detectFormat(hit.tag, items), itemTag: hit.tag, items, total: hit.items.length, fields: describeFields(items) };
}
