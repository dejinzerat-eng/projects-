/**
 * Normalizovaný text pro vyhledávání v PostgreSQL (sloupec Listing.searchText).
 * Malá písmena, bez diakritiky, jen písmena a číslice oddělené mezerou.
 * Stejnou normalizací prochází i dotaz, takže „kocarek“ najde „Kočárek“.
 */

/** Znaky s diakritikou a jejich náhrady – používá se v SQL translate() při doplnění starých řádků. */
export const DIACRITICS_FROM = 'áäàâãåčćçďéěëèêíïìîĺľłňńñóöôòõőŕřšśťúůüùûűýÿžźżÁÄÀÂÃÅČĆÇĎÉĚËÈÊÍÏÌÎĹĽŁŇŃÑÓÖÔÒÕŐŔŘŠŚŤÚŮÜÙÛŰÝŸŽŹŻ';
export const DIACRITICS_TO = [...DIACRITICS_FROM].map((ch) => ({ ł: 'l', Ł: 'L' } as Record<string, string>)[ch] ?? ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join('');

const MAP = new Map([...DIACRITICS_FROM].map((ch, i) => [ch, DIACRITICS_TO[i]]));

/** „Kočárek – ŠKODA 1.6“ → „kocarek skoda 1 6“ */
export function normalizeSearchText(s: string): string {
  let out = '';
  for (const ch of s) out += MAP.get(ch) ?? ch;
  return out
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Hodnoty parametrů inzerátu (značka, model…) jako text. Bool hodnoty se vynechají. */
export function attributesText(attrs: unknown): string {
  if (!attrs || typeof attrs !== 'object') return '';
  const parts: string[] = [];
  for (const v of Object.values(attrs as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number') parts.push(String(v));
    else if (Array.isArray(v)) parts.push(...v.filter((x) => typeof x === 'string' || typeof x === 'number').map(String));
  }
  return parts.join(' ');
}

/** Obsah sloupce searchText: název + popis + parametry + město. */
export function buildSearchText(l: { title: string; description?: string | null; attributes?: unknown; city?: string | null }): string {
  return normalizeSearchText([l.title, l.description ?? '', attributesText(l.attributes), l.city ?? ''].join(' ')).slice(0, 12000);
}

const SUFFIXES = ['ami', 'emi', 'ech', 'ich', 'ach', 'ove', 'ovi', 'ych', 'ymi', 'ky', 'ek', 'ka', 'ku', 'ce', 'em', 'ou', 'um', 'y', 'u', 'e', 'a', 'i', 'o'];

/**
 * Velmi jednoduché odříznutí české koncovky („kočárky“ → „kocar“, „notebooky“ → „notebook“),
 * aby se našly i jiné tvary slova. Krátká slova (do 4 znaků) a čísla se nemění, kmen má nejméně 3 znaky.
 */
export function stemCz(word: string): string {
  if (word.length < 5 || /\d/.test(word)) return word;
  for (const s of SUFFIXES) if (word.endsWith(s) && word.length - s.length >= 3) return word.slice(0, -s.length);
  return word;
}

/** Slova dotazu bez diakritiky; prázdná a duplicitní slova se vynechají, nejvýše 8 slov. */
export function queryWords(q: string): string[] {
  return [...new Set(normalizeSearchText(q).split(' ').filter(Boolean))].slice(0, 8);
}
