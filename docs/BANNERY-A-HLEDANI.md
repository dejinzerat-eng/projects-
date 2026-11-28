# Reklamní bannery a hledání v okolí na úvodní stránce

## Reklamní bannery

Na úvodní stránce je pod „Doporučenými nabídkami“ řada až **3 reklamních bannerů** vedle sebe
(na mobilu pod sebou). Nahradila dřívější sekci „Nabídky v okolí“. Každý banner má v rohu štítek
„Reklama“ (obchodní sdělení musí být rozpoznatelné).

### Správa (Administrace › Reklamní bannery, `/admin/bannery`)

1. **Vybrat obrázek** – JPG, PNG, WebP nebo GIF (animace zůstane) do 4 MB. Doporučený rozměr
   **1200 × 600 px** (poměr 2 : 1); jiný poměr se na webu ořízne na střed.
2. **Popis obrázku** – krátký text pro nevidomé a vyhledávače (povinný).
3. **Odkaz** – `https://…` (otevře se v novém okně, `rel="sponsored"`), nebo cesta na našem webu
   začínající `/` (např. `/kategorie/auto-moto`). Bez odkazu je banner jen obrázek.
4. **Přidat banner**.

U každého banneru lze změnit popis, odkaz a obrázek (starý soubor se smaže), zapnout/vypnout
(„Aktivní“), posunout šipkami v pořadí a smazat. Zobrazují se **první 3 aktivní** v pořadí;
ostatní aktivní čekají („Čeká – zobrazují se jen první 3“). Bez aktivního banneru se řada vůbec
nezobrazí. Změny se na webu projeví do půl minuty (krátká mezipaměť).

U každého banneru je vidět **počet kliknutí** (počítá se na pozadí, odkaz vede přímo na cíl).

Oprávnění: `banners.manage` – hlavní administrátor, administrátor a správce obchodních účtů.
Všechny změny se zapisují do auditního logu (`banner.create`, `banner.update`, `banner.move`, `banner.delete`).

### Technicky

- Tabulka `Banner` (migrace `20261128170000_banners`), API `apps/api/src/banners/`.
- Veřejně: `GET /banners` (aktivní, max. 3), `POST /banners/:id/click` (počítadlo).
- Správa: `GET/POST /admin/banners`, `PUT/DELETE /admin/banners/:id`, `POST /admin/banners/:id/move`
  (formulář multipart: `file`, `alt`, `linkUrl`, `active`). Obrázek se zmenší na max. 1200 px a uloží jako WebP.
- Web: `components/home-banners.tsx`, `components/admin/banners.tsx`.
- Testy: `apps/api/src/banners/banners.spec.ts` (kontrola odkazů a polí formuláře).

## Hledání v okolí (lokalita ve vyhledávání)

Vyhledávací pole na úvodní stránce má vpravo volbu lokality („Celá ČR“ / „Brno +30 km“).
Po kliknutí: **Použít moji polohu**, nebo obec či PSČ (našeptávač všech obcí ČR), a okruh
10 / 30 / 50 / 100 km. Tlačítko **Zobrazit nabídky v okolí** ukáže vše v okolí bez hledaného
slova; s napsaným slovem hledá **Hledat** jen v okolí. Volba se pamatuje jen v prohlížeči
(stejně jako ve filtrech výsledků); „Celá ČR“ ji zruší.

Obec se do výsledků předává jako `mesto=…&okruh=…` (ve filtrech je pak vidět název obce),
poloha z prohlížeče jako `lat=…&lng=…&okruh=…`. Kód: `components/search-location.tsx`, `components/search-box.tsx` (`withLocation`).
