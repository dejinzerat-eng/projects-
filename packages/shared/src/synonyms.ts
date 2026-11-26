import { normalizeSearchText } from './search-text';

/**
 * Skupiny významově shodných výrazů pro vyhledávání (bez diakritiky se normalizují automaticky).
 * Hledání kteréhokoli výrazu najde inzeráty s libovolným jiným výrazem ze stejné skupiny.
 */
export const SYNONYM_GROUPS: string[][] = [
  // Elektronika
  ['mobil', 'mobilní telefon', 'telefon', 'smartphone', 'chytrý telefon'],
  ['iphone', 'ajfoun', 'ifon', 'iphon'],
  ['notebook', 'laptop', 'ntb', 'noťas'],
  ['počítač', 'pc', 'stolní počítač', 'desktop'],
  ['televize', 'tv', 'televizor', 'telka'],
  ['tablet', 'ipad'],
  ['sluchátka', 'headset', 'airpods'],
  ['playstation', 'ps4', 'ps5', 'ps 5', 'ps 4'],
  ['xbox', 'x box'],
  ['herní konzole', 'konzole', 'konzola'],
  ['fotoaparát', 'foťák', 'zrcadlovka'],
  ['monitor', 'displej', 'obrazovka'],
  ['tiskárna', 'printer'],
  ['reproduktor', 'repro', 'reprák', 'bedny'],
  ['hodinky', 'smartwatch', 'chytré hodinky'],
  ['nabíječka', 'nabíječ', 'adaptér'],
  ['wifi', 'wi fi', 'router'],
  // Auto-moto
  ['auto', 'auta', 'automobil', 'vůz', 'osobní auto', 'osobák'],
  ['motorka', 'motocykl', 'moto'],
  ['skútr', 'skútry', 'scooter'],
  ['pneumatiky', 'pneu', 'gumy'],
  ['kola na auto', 'alu kola', 'disky', 'elektrony'],
  ['dodávka', 'užitkové auto', 'van'],
  ['karavan', 'obytný vůz', 'obytňák'],
  ['škoda', 'skoda'],
  ['volkswagen', 'vw'],
  ['octavia', 'oktávie', 'oktavka'],
  ['mercedes', 'mercedes benz', 'mercedes-benz'],
  // Sport
  ['kolo', 'kola', 'jízdní kolo', 'bicykl', 'bike'],
  ['horské kolo', 'mtb', 'horák'],
  ['elektrokolo', 'e kolo', 'ebike', 'e bike'],
  ['koloběžka', 'kolobezka', 'scooter'],
  ['brusle', 'kolečkové brusle', 'inlajny', 'inline brusle'],
  ['lyže', 'lyze', 'ski'],
  ['snowboard', 'snb'],
  ['stan', 'tent'],
  ['činky', 'jednoručky', 'závaží'],
  ['rotoped', 'stacionární kolo'],
  // Dům a byt
  ['gauč', 'pohovka', 'sedačka', 'kanape', 'sofa'],
  ['křeslo', 'kreslo'],
  ['postel', 'lůžko', 'manželská postel'],
  ['matrace', 'madrace'],
  ['skříň', 'šatník', 'šatní skříň'],
  ['komoda', 'prádelník'],
  ['stůl', 'stolek', 'jídelní stůl'],
  ['židle', 'stolička'],
  ['lednice', 'lednička', 'chladnička', 'chladnicka'],
  ['pračka', 'automatická pračka'],
  ['myčka', 'myčka nádobí'],
  ['sporák', 'kamna', 'trouba'],
  ['mikrovlnka', 'mikrovlnná trouba', 'mikrovlnná'],
  ['vysavač', 'luxor', 'lux'],
  ['kávovar', 'presovač', 'espresso'],
  ['lampa', 'lustr', 'světlo', 'svítidlo'],
  ['koberec', 'kobereček', 'předložka'],
  ['zahradní nábytek', 'zahradní sezení'],
  ['sekačka', 'sekačka na trávu', 'travní sekačka'],
  ['křovinořez', 'vyžínač'],
  ['nábytek', 'nabytek'],
  // Děti
  ['kočárek', 'kocarek', 'kočár', 'golfky', 'sportovní kočárek'],
  ['autosedačka', 'vajíčko', 'autosedacka'],
  ['dětská postýlka', 'postýlka', 'postylka'],
  ['hračky', 'hračka', 'hracky'],
  ['lego', 'stavebnice'],
  ['odrážedlo', 'odrazedlo'],
  // Oblečení
  ['bunda', 'větrovka', 'parka'],
  ['kabát', 'kabat'],
  ['boty', 'obuv', 'tenisky', 'botasky'],
  ['mikina', 'svetr'],
  ['šaty', 'saty'],
  ['džíny', 'jeansy', 'rifle', 'kalhoty'],
  ['tričko', 'triko', 'tshirt', 't shirt'],
  // Reality
  ['byt', 'byty', 'bytu', 'apartmán'],
  ['dům', 'domy', 'domu', 'rodinný dům', 'rd', 'domek'],
  ['chata', 'chalupa', 'rekreační objekt'],
  ['pozemek', 'parcela', 'stavební pozemek'],
  ['garáž', 'garaz', 'garážové stání'],
  ['pronájem', 'nájem', 'podnájem'],
  // Zvířata
  ['pes', 'psi', 'psa', 'štěně', 'štěňata', 'pejsek', 'psík'],
  ['kočka', 'kotě', 'kočička'],
  ['akvárium', 'akvarium', 'terárium'],
  // Hobby a ostatní
  ['kniha', 'knihy', 'knížka'],
  ['gramofon', 'vinyl', 'lp desky'],
  ['kytara', 'elektrická kytara', 'akustická kytara'],
  ['piano', 'klavír', 'digitální piano', 'keyboard'],
  ['nářadí', 'naradi', 'nástroje'],
  ['vrtačka', 'aku vrtačka', 'šroubovák'],
  ['pila', 'motorová pila', 'motorovka'],
  ['dřevo', 'palivové dřevo', 'polena'],
];

const INDEX: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const g of SYNONYM_GROUPS) {
    const norm = [...new Set(g.map(normalizeSearchText).filter(Boolean))];
    for (const t of norm) m.set(t, [...new Set([...(m.get(t) ?? []), ...norm])]);
  }
  return m;
})();

/** Výrazy se stejným významem jako normalizované slovo nebo fráze (včetně jí samotné). */
export function synonymsOf(term: string): string[] {
  const t = normalizeSearchText(term);
  return INDEX.get(t) ?? [t];
}

/** Všechny normalizované výrazy, které mají synonyma – pro testy a Meilisearch. */
export function synonymMap(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of INDEX) out[k] = v.filter((x) => x !== k);
  return out;
}
