/**
 * Strom kategorií a jejich filtrů. Slouží jako výchozí data (seed) –
 * v produkci se kategorie spravují v administraci a ukládají v databázi.
 */

export type FilterType = 'select' | 'multiselect' | 'range' | 'boolean';

export interface FilterDef {
  key: string;
  label: string;
  type: FilterType;
  /** Pro select/multiselect */
  options?: string[];
  /** Pro range */
  unit?: string;
  min?: number;
  max?: number;
}

export interface CategoryDef {
  slug: string;
  name: string;
  icon: string;
  filters: FilterDef[];
  children: { slug: string; name: string; filters?: FilterDef[] }[];
}

const year = (label = 'Rok výroby'): FilterDef => ({ key: 'year', label, type: 'range', min: 1950, max: 2026 });
const brand = (options: string[]): FilterDef => ({ key: 'brand', label: 'Značka', type: 'select', options });
const size = (options: string[], label = 'Velikost'): FilterDef => ({ key: 'size', label, type: 'multiselect', options });

export const CATEGORIES: CategoryDef[] = [
  {
    slug: 'auto-moto', name: 'Auto-moto', icon: 'car',
    filters: [
      brand(['Škoda', 'Volkswagen', 'Toyota', 'Hyundai', 'Ford', 'BMW', 'Audi', 'Mercedes-Benz', 'Renault', 'Peugeot', 'Kia', 'Dacia', 'Opel', 'Tesla', 'Jiná']),
      year(),
      { key: 'mileage', label: 'Najeto', type: 'range', unit: 'km', min: 0, max: 500000 },
      { key: 'fuel', label: 'Palivo', type: 'multiselect', options: ['Benzín', 'Nafta', 'Hybrid', 'Elektro', 'LPG', 'CNG'] },
      { key: 'gearbox', label: 'Převodovka', type: 'select', options: ['Manuální', 'Automatická'] },
      { key: 'body', label: 'Karoserie', type: 'select', options: ['Hatchback', 'Sedan', 'Kombi', 'SUV', 'MPV', 'Kupé', 'Kabriolet', 'Pick-up', 'Dodávka'] },
      { key: 'power', label: 'Výkon', type: 'range', unit: 'kW', min: 0, max: 500 },
    ],
    children: [
      { slug: 'osobni-automobily', name: 'Osobní automobily' },
      { slug: 'motocykly-a-skutry', name: 'Motocykly a skútry' },
      { slug: 'uzitkove-vozy', name: 'Užitkové vozy' },
      { slug: 'nahradni-dily', name: 'Náhradní díly', filters: [] },
      { slug: 'pneumatiky-a-kola', name: 'Pneumatiky a kola', filters: [] },
      { slug: 'karavany-a-privesy', name: 'Karavany a přívěsy' },
      { slug: 'prislusenstvi', name: 'Příslušenství' },
    ],
  },
  {
    slug: 'reality', name: 'Reality', icon: 'house',
    filters: [
      { key: 'offerType', label: 'Typ nabídky', type: 'select', options: ['Prodej', 'Pronájem', 'Podnájem'] },
      { key: 'layout', label: 'Dispozice', type: 'multiselect', options: ['1+kk', '1+1', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1', '5+ a větší'] },
      { key: 'area', label: 'Užitná plocha', type: 'range', unit: 'm²', min: 0, max: 1000 },
      { key: 'ownership', label: 'Vlastnictví', type: 'select', options: ['Osobní', 'Družstevní', 'Státní/obecní'] },
      { key: 'energy', label: 'Energetická třída', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
    ],
    children: [
      { slug: 'byty-na-prodej', name: 'Byty na prodej' },
      { slug: 'byty-k-pronajmu', name: 'Byty k pronájmu' },
      { slug: 'domy', name: 'Domy' },
      { slug: 'pozemky', name: 'Pozemky' },
      { slug: 'chaty-a-chalupy', name: 'Chaty a chalupy' },
      { slug: 'komercni-prostory', name: 'Komerční prostory' },
      { slug: 'garaze', name: 'Garáže' },
    ],
  },
  {
    slug: 'elektronika', name: 'Elektronika', icon: 'tv',
    filters: [brand(['Samsung', 'LG', 'Sony', 'Philips', 'Panasonic', 'Bose', 'JBL', 'Xiaomi', 'Jiná']), { key: 'warranty', label: 'V záruce', type: 'boolean' }],
    children: [
      { slug: 'televize', name: 'Televize' },
      { slug: 'audio-technika', name: 'Audio technika' },
      { slug: 'fotoaparaty-a-video', name: 'Fotoaparáty a video' },
      { slug: 'herni-konzole', name: 'Herní konzole' },
      { slug: 'domaci-spotrebice', name: 'Domácí spotřebiče' },
      { slug: 'chytra-domacnost', name: 'Chytrá domácnost' },
    ],
  },
  {
    slug: 'mobily-a-prislusenstvi', name: 'Mobily a příslušenství', icon: 'smartphone',
    filters: [
      brand(['Apple', 'Samsung', 'Xiaomi', 'Google', 'Motorola', 'OnePlus', 'Huawei', 'Nokia', 'Jiná']),
      { key: 'storage', label: 'Úložiště', type: 'multiselect', options: ['64 GB', '128 GB', '256 GB', '512 GB', '1 TB'] },
      { key: 'battery', label: 'Kondice baterie', type: 'range', unit: '%', min: 0, max: 100 },
      { key: 'warranty', label: 'V záruce', type: 'boolean' },
    ],
    children: [
      { slug: 'mobilni-telefony', name: 'Mobilní telefony' },
      { slug: 'chytre-hodinky', name: 'Chytré hodinky' },
      { slug: 'tablety', name: 'Tablety' },
      { slug: 'prislusenstvi', name: 'Příslušenství', filters: [] },
    ],
  },
  {
    slug: 'pocitace-a-it', name: 'Počítače a IT', icon: 'laptop',
    filters: [
      brand(['Apple', 'Lenovo', 'Dell', 'HP', 'Asus', 'Acer', 'MSI', 'Jiná']),
      { key: 'ram', label: 'Operační paměť', type: 'multiselect', options: ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB+'] },
      { key: 'warranty', label: 'V záruce', type: 'boolean' },
    ],
    children: [
      { slug: 'notebooky', name: 'Notebooky' },
      { slug: 'stolni-pocitace', name: 'Stolní počítače' },
      { slug: 'komponenty', name: 'Komponenty' },
      { slug: 'monitory', name: 'Monitory' },
      { slug: 'periferie-a-prislusenstvi', name: 'Periferie a příslušenství' },
      { slug: 'site-a-servery', name: 'Sítě a servery' },
    ],
  },
  {
    slug: 'nabytek-a-bydleni', name: 'Nábytek a bydlení', icon: 'sofa',
    filters: [{ key: 'material', label: 'Materiál', type: 'multiselect', options: ['Dřevo', 'Kov', 'Plast', 'Sklo', 'Látka', 'Kůže'] }, { key: 'delivery', label: 'Možnost dovozu', type: 'boolean' }],
    children: [
      { slug: 'obyvaci-pokoj', name: 'Obývací pokoj' },
      { slug: 'loznice', name: 'Ložnice' },
      { slug: 'kuchyne-a-jidelna', name: 'Kuchyně a jídelna' },
      { slug: 'koupelna', name: 'Koupelna' },
      { slug: 'dekorace-a-doplnky', name: 'Dekorace a doplňky' },
      { slug: 'osvetleni', name: 'Osvětlení' },
    ],
  },
  {
    slug: 'dum-a-zahrada', name: 'Dům a zahrada', icon: 'flower',
    filters: [{ key: 'delivery', label: 'Možnost dovozu', type: 'boolean' }],
    children: [
      { slug: 'zahradni-technika', name: 'Zahradní technika' },
      { slug: 'zahradni-nabytek', name: 'Zahradní nábytek' },
      { slug: 'rostliny-a-semena', name: 'Rostliny a semena' },
      { slug: 'stavebniny', name: 'Stavebniny' },
      { slug: 'vytapeni-a-klimatizace', name: 'Vytápění a klimatizace' },
      { slug: 'bazeny-a-virivky', name: 'Bazény a vířivky' },
    ],
  },
  {
    slug: 'obleceni-a-obuv', name: 'Oblečení a obuv', icon: 'shirt',
    filters: [
      { key: 'gender', label: 'Pro koho', type: 'select', options: ['Dámské', 'Pánské', 'Unisex'] },
      size(['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']),
      brand(['Nike', 'Adidas', 'Zara', 'H&M', 'Puma', 'The North Face', 'Levi\'s', 'Jiná']),
    ],
    children: [
      { slug: 'damske-obleceni', name: 'Dámské oblečení' },
      { slug: 'panske-obleceni', name: 'Pánské oblečení' },
      { slug: 'obuv', name: 'Obuv', filters: [size(['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'], 'Velikost bot')] },
      { slug: 'doplnky-a-sperky', name: 'Doplňky a šperky' },
      { slug: 'kabelky-a-tasky', name: 'Kabelky a tašky' },
    ],
  },
  {
    slug: 'deti-a-kojenecke-potreby', name: 'Děti a kojenecké potřeby', icon: 'baby',
    filters: [{ key: 'age', label: 'Věk dítěte', type: 'select', options: ['0–6 měsíců', '6–12 měsíců', '1–3 roky', '3–6 let', '6–10 let', '10+ let'] }],
    children: [
      { slug: 'kocarky', name: 'Kočárky' },
      { slug: 'autosedacky', name: 'Autosedačky' },
      { slug: 'detske-obleceni', name: 'Dětské oblečení', filters: [size(['50', '56', '62', '68', '74', '80', '86', '92', '98', '104', '110', '116', '122', '128', '134', '140', '146', '152'])] },
      { slug: 'hracky', name: 'Hračky' },
      { slug: 'detsky-nabytek', name: 'Dětský nábytek' },
    ],
  },
  {
    slug: 'sport-a-volny-cas', name: 'Sport a volný čas', icon: 'bike',
    filters: [brand(['Specialized', 'Trek', 'Author', 'Kellys', 'Head', 'Atomic', 'Salomon', 'Jiná'])],
    children: [
      { slug: 'cyklistika', name: 'Cyklistika', filters: [{ key: 'frame', label: 'Velikost rámu', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL'] }, { key: 'wheel', label: 'Velikost kol', type: 'select', options: ['20"', '24"', '26"', '27,5"', '29"', '700c'] }] },
      { slug: 'zimni-sporty', name: 'Zimní sporty' },
      { slug: 'fitness-a-posilovani', name: 'Fitness a posilování' },
      { slug: 'turistika-a-kempovani', name: 'Turistika a kempování' },
      { slug: 'vodni-sporty', name: 'Vodní sporty' },
      { slug: 'micove-sporty', name: 'Míčové sporty' },
    ],
  },
  {
    slug: 'zvirata-a-chovatelske-potreby', name: 'Zvířata a chovatelské potřeby', icon: 'paw-print',
    filters: [{ key: 'pedigree', label: 'S průkazem původu', type: 'boolean' }, { key: 'sex', label: 'Pohlaví', type: 'select', options: ['Samec', 'Samice'] }],
    children: [
      { slug: 'psi', name: 'Psi' },
      { slug: 'kocky', name: 'Kočky' },
      { slug: 'hlodavci', name: 'Hlodavci' },
      { slug: 'ptaci', name: 'Ptáci' },
      { slug: 'akvaristika-a-teraristika', name: 'Akvaristika a teraristika' },
      { slug: 'chovatelske-potreby', name: 'Chovatelské potřeby', filters: [] },
    ],
  },
  {
    slug: 'prace-a-brigady', name: 'Práce a brigády', icon: 'briefcase',
    filters: [
      { key: 'jobType', label: 'Typ úvazku', type: 'multiselect', options: ['Plný úvazek', 'Částečný úvazek', 'Brigáda', 'DPP/DPČ', 'IČO', 'Home office'] },
      { key: 'salary', label: 'Mzda', type: 'range', unit: 'Kč/měs.', min: 0, max: 200000 },
    ],
    children: [
      { slug: 'nabidka-prace', name: 'Nabídka práce' },
      { slug: 'brigady', name: 'Brigády' },
      { slug: 'hledam-praci', name: 'Hledám práci' },
    ],
  },
  {
    slug: 'sluzby-a-remesla', name: 'Služby a řemesla', icon: 'wrench',
    filters: [{ key: 'area', label: 'Působnost', type: 'select', options: ['Místní', 'Celý kraj', 'Celá ČR', 'Online'] }],
    children: [
      { slug: 'remesla-a-opravy', name: 'Řemesla a opravy' },
      { slug: 'stehovani-a-doprava', name: 'Stěhování a doprava' },
      { slug: 'uklid', name: 'Úklid' },
      { slug: 'doucovani-a-kurzy', name: 'Doučování a kurzy' },
      { slug: 'krasa-a-zdravi', name: 'Krása a zdraví' },
      { slug: 'it-a-web', name: 'IT a web' },
    ],
  },
  {
    slug: 'stroje-a-naradi', name: 'Stroje a nářadí', icon: 'drill',
    filters: [brand(['Bosch', 'Makita', 'DeWalt', 'Milwaukee', 'Metabo', 'Hilti', 'Stihl', 'Husqvarna', 'Jiná']), { key: 'power', label: 'Napájení', type: 'select', options: ['Aku', 'Síť', 'Benzín', 'Ruční'] }],
    children: [
      { slug: 'elektricke-naradi', name: 'Elektrické nářadí' },
      { slug: 'rucni-naradi', name: 'Ruční nářadí' },
      { slug: 'stavebni-stroje', name: 'Stavební stroje' },
      { slug: 'zemedelske-stroje', name: 'Zemědělské stroje' },
      { slug: 'dilenske-vybaveni', name: 'Dílenské vybavení' },
    ],
  },
  {
    slug: 'hudba-a-hudebni-nastroje', name: 'Hudba a hudební nástroje', icon: 'music',
    filters: [brand(['Yamaha', 'Fender', 'Gibson', 'Roland', 'Korg', 'Ibanez', 'Pearl', 'Jiná'])],
    children: [
      { slug: 'kytary-a-baskytary', name: 'Kytary a baskytary' },
      { slug: 'klavesy-a-piana', name: 'Klávesy a piana' },
      { slug: 'bici-nastroje', name: 'Bicí nástroje' },
      { slug: 'dechove-nastroje', name: 'Dechové nástroje' },
      { slug: 'studio-a-ozvuceni', name: 'Studio a ozvučení' },
      { slug: 'desky-cd-a-noty', name: 'Desky, CD a noty' },
    ],
  },
  {
    slug: 'sberatelstvi-a-starozitnosti', name: 'Sběratelství a starožitnosti', icon: 'gem',
    filters: [{ key: 'era', label: 'Období', type: 'select', options: ['Před 1900', '1900–1945', '1945–1989', 'Po 1989'] }],
    children: [
      { slug: 'mince-a-bankovky', name: 'Mince a bankovky' },
      { slug: 'znamky', name: 'Známky' },
      { slug: 'starozitnosti', name: 'Starožitnosti' },
      { slug: 'obrazy-a-umeni', name: 'Obrazy a umění' },
      { slug: 'modely-a-figurky', name: 'Modely a figurky' },
      { slug: 'stare-knihy-a-komiksy', name: 'Staré knihy a komiksy' },
    ],
  },
  {
    slug: 'knihy-a-ucebnice', name: 'Knihy a učebnice', icon: 'book-open',
    filters: [{ key: 'bookLang', label: 'Jazyk', type: 'select', options: ['Čeština', 'Slovenština', 'Angličtina', 'Němčina', 'Jiný'] }, { key: 'binding', label: 'Vazba', type: 'select', options: ['Pevná', 'Brožovaná', 'E-kniha', 'Audiokniha'] }],
    children: [
      { slug: 'beletrie', name: 'Beletrie' },
      { slug: 'ucebnice-a-skripta', name: 'Učebnice a skripta' },
      { slug: 'odborna-literatura', name: 'Odborná literatura' },
      { slug: 'detske-knihy', name: 'Dětské knihy' },
      { slug: 'komiksy-a-manga', name: 'Komiksy a manga' },
      { slug: 'casopisy', name: 'Časopisy' },
    ],
  },
  {
    slug: 'hobby-a-volny-cas', name: 'Hobby a volný čas', icon: 'palette',
    filters: [],
    children: [
      { slug: 'deskove-a-karetni-hry', name: 'Deskové a karetní hry' },
      { slug: 'modelarstvi', name: 'Modelářství' },
      { slug: 'rucni-prace-a-vytvarne-potreby', name: 'Ruční práce a výtvarné potřeby' },
      { slug: 'rybareni', name: 'Rybaření' },
      { slug: 'myslivost', name: 'Myslivost' },
      { slug: 'zazitky-a-cestovani', name: 'Zážitky a cestování' },
    ],
  },
  {
    slug: 'potraviny-a-zemedelstvi', name: 'Potraviny a zemědělství', icon: 'wheat',
    filters: [{ key: 'bio', label: 'Bio / farmářské', type: 'select', options: ['Ano', 'Ne'] }],
    children: [
      { slug: 'farmarske-potraviny', name: 'Farmářské potraviny' },
      { slug: 'ovoce-a-zelenina', name: 'Ovoce a zelenina' },
      { slug: 'med-a-vceli-produkty', name: 'Med a včelí produkty' },
      { slug: 'hospodarska-zvirata', name: 'Hospodářská zvířata' },
      { slug: 'zemedelska-technika', name: 'Zemědělská technika' },
      { slug: 'osiva-sazenice-a-krmiva', name: 'Osiva, sazenice a krmiva' },
    ],
  },
  {
    slug: 'ostatni', name: 'Ostatní', icon: 'shapes',
    filters: [],
    children: [
      { slug: 'vstupenky-a-poukazy', name: 'Vstupenky a poukazy' },
      { slug: 'daruji-zdarma', name: 'Daruji zdarma' },
      { slug: 'vymena', name: 'Výměna' },
      { slug: 'ruzne', name: 'Různé' },
    ],
  },
];

export const CONDITIONS = [
  { value: 'NEW', label: 'Nové' },
  { value: 'LIKE_NEW', label: 'Jako nové' },
  { value: 'USED', label: 'Použité' },
  { value: 'DAMAGED', label: 'Poškozené' },
] as const;

export const OFFER_TYPES = [
  { value: 'SELL', label: 'Prodám' },
  { value: 'BUY', label: 'Koupím' },
  { value: 'EXCHANGE', label: 'Vyměním' },
  { value: 'GIVE', label: 'Daruji' },
  { value: 'RENT', label: 'Pronajmu' },
] as const;

export type Condition = (typeof CONDITIONS)[number]['value'];
export type OfferType = (typeof OFFER_TYPES)[number]['value'];

/** Filtry platné pro danou (pod)kategorii: filtry rodiče + vlastní filtry podkategorie. */
export function filtersFor(categorySlug: string, subSlug?: string): FilterDef[] {
  const cat = CATEGORIES.find((c) => c.slug === categorySlug);
  if (!cat) return [];
  const sub = subSlug ? cat.children.find((s) => s.slug === subSlug) : undefined;
  if (sub?.filters && sub.filters.length === 0) return [];
  const own = sub?.filters ?? [];
  const ownKeys = new Set(own.map((f) => f.key));
  return [...cat.filters.filter((f) => !ownKeys.has(f.key)), ...own];
}
