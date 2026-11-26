// Vygeneruje src/municipalities-data.ts – seznam všech obcí ČR (kraj, okres, PSČ, souřadnice).
//
// Zdroj: https://github.com/33bcdd/souradnice-mest (souradnice.csv, stav k 1. 1. 2018, 6 259 obcí
// včetně vojenských újezdů). Data vycházejí z otevřených dat ČSÚ; autor je poskytuje „bez záruky,
// volně k použití“. Názvy statutárních měst jsou ve zdroji velkými písmeny – zde se převádějí.
//
// Spuštění:  node scripts/build-municipalities.mjs [cesta-k-souradnice.csv]
// Bez argumentu se CSV stáhne z raw.githubusercontent.com.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = 'https://raw.githubusercontent.com/33bcdd/souradnice-mest/master/souradnice.csv';
const here = dirname(fileURLToPath(import.meta.url));
const csv = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : await (await fetch(SRC)).text();

// Kód kraje (NUTS 3) → kód kraje v aplikaci (packages/shared/src/locations.ts REGIONS)
const KRAJ = {
  CZ010: 'PHA', CZ020: 'STC', CZ031: 'JHC', CZ032: 'PLK', CZ041: 'KVK', CZ042: 'ULK', CZ051: 'LBK',
  CZ052: 'HKK', CZ053: 'PAK', CZ063: 'VYS', CZ064: 'JHM', CZ071: 'OLK', CZ072: 'ZLK', CZ080: 'MSK',
};
const SMALL = new Set(['nad', 'pod', 'u', 'v', 've', 'na', 'při', 'pri', 'by']);
const titleCase = (s) => s.toLocaleLowerCase('cs')
  .split(' ')
  .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.split('-').map((p) => p.charAt(0).toLocaleUpperCase('cs') + p.slice(1)).join('-')))
  .join(' ');

const lines = csv.trim().split(/\r?\n/).slice(1);
const okresy = [];
const rows = [];
for (const line of lines) {
  const [obec, , okres, , , krajKod, psc, lat, lng] = line.split(',');
  const region = KRAJ[krajKod];
  if (!region || !/^\d{5}$/.test(psc)) throw new Error(`Neplatný řádek: ${line}`);
  const name = obec === obec.toLocaleUpperCase('cs') ? titleCase(obec) : obec;
  let oi = okresy.indexOf(okres);
  if (oi < 0) { okresy.push(okres); oi = okresy.length - 1; }
  rows.push([name, oi, region, psc, Number(lat).toFixed(4), Number(lng).toFixed(4)].join('|'));
}
if (rows.length < 6000) throw new Error(`Málo obcí: ${rows.length}`);

const out = `// Vygenerováno skriptem scripts/build-municipalities.mjs – neupravujte ručně.
// Zdroj: github.com/33bcdd/souradnice-mest (otevřená data ČSÚ, „bez záruky, volně k použití“), ${rows.length} obcí.
// Formát řádku: název|index okresu|kód kraje|PSČ|zeměpisná šířka|zeměpisná délka

export const OKRESY: string[] = ${JSON.stringify(okresy)};

export const MUNICIPALITIES_RAW = ${JSON.stringify(rows.join('\n'))};
`;
writeFileSync(join(here, '..', 'src', 'municipalities-data.ts'), out);
console.log(`Zapsáno ${rows.length} obcí, ${okresy.length} okresů.`);
