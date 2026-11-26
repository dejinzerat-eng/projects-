# Import inzerátů ze starého webu www.dejinzerat.cz

Starý web (vlastní aplikace SvelteKit) se nahrazuje novým systémem. Import přenese všechny zveřejněné
inzeráty, jejich fotky a prodejce. Nepotřebuje přístup do administrace ani databáze starého webu –
čte veřejná data stránek (`__data.json`).

## Jak ho spustit (administrace)

1. Přihlaste se jako hlavní administrátor a otevřete **Administrace › Import ze starého webu** (`/admin/import`).
2. **Načíst náhled** – ukáže počet inzerátů, prodejců a fotek, co je nové / změněné a do jaké nové
   kategorie každý inzerát půjde. Nic se neukládá.
3. **Spustit import** – přenese inzeráty po dávkách (ukazuje průběh). Když se přeruší, stačí ho spustit
   znovu, pokračuje bez duplicit.
4. Inzeráty, které na starém webu mezitím zmizely, nabídne stránka ke stažení (stav „vypršelý“).
5. **Rozeslat přístupy** – až po přepnutí na ostrou doménu a nastavení e-mailů (Resend). Každý prodejce
   dostane odkaz na nastavení hesla (platí 14 dní, jen jednou). Hesla se e-mailem neposílají.

Import lze opakovat kdykoli. **Poslední import spusťte těsně před přepnutím domény**, dokud starý web
ještě běží na www.dejinzerat.cz. Pokud by starý web potom běžel jinde, nastavte ve Vercelu proměnnou
`LEGACY_SOURCE_URL` (např. `https://stary.dejinzerat.cz`).

## Co import dělá

| Starý web | Nový systém |
|---|---|
| 12 kategorií s podkategoriemi | 20 nových kategorií (tabulka v `apps/api/src/legacy/legacy-map.ts`, upřesnění podle textu: služby, garáže, pronájem, kočky…) |
| Popis v HTML | prostý text s odstavci |
| Cena 0 nebo 1 | „cena neuvedena“ |
| Jen kraj | kraj; město jen když ho inzerát sám jmenuje, prázdné = „Celá ČR“ |
| Fotky `/inzeraty_images/…` | zmenšené na 1600 px + náhled, uložené v našem úložišti (Vercel Blob) |
| Prodejce | účet podle e-mailu bez hesla (už registrovaný e-mail se jen propojí), telefon uložený, ale neověřený – u inzerátu se nezobrazí |
| Datum vložení | zachováno; platnost inzerátu se při každém importu prodlouží, dokud si prodejce účet nepřevezme |

- **Podezřelé inzeráty** (běžná automatická kontrola obsahu: např. „štěňata zdarma k adopci“, rychlé půjčky,
  léky na předpis) se přenesou jako **čekající na schválení** – rozhodnete v Administrace › Inzeráty.
- **Opakování:** inzerát i prodejce mají `legacyId`, nic se nezdvojí. Změněný inzerát na starém webu se
  aktualizuje (včetně fotek). Inzerát upravený v novém systému (moderátorem nebo prodejcem, který si účet
  převzal) import nepřepíše.
- **Staré odkazy:** `/produkt?id=…` vede na nový inzerát; staré adresy kategorií a stránek (`/kategorie/auto-moto-lode`,
  `/login`, `/podminky`…) mají trvalé přesměrování (`packages/shared/src/legacy.ts`). Začnou se používat po přepnutí domény.

## Osobní údaje (GDPR)

Provozovatel obou webů je stejný a účel (inzerce) se nemění, proto jde o přenos údajů v rámci jedné služby.
Přenáší se jen to, co prodejci sami zveřejnili (jméno/přezdívka, e-mail, telefon, inzeráty). Hesla ze starého
webu se nepřenáší. Pozvánka prodejce informuje o přenosu a o tom, že účet může kdykoli smazat (Nastavení účtu
› Smazat účet). Doporučení: doplnit tuto informaci i do Zásad ochrany osobních údajů.

## Testy

- `apps/api/src/legacy/legacy-map.spec.ts` – převod kategorií, textů, ceny, místa, telefonů, formát dat starého webu.
- `pnpm --filter @dej/api legacy:e2e` – celý průběh proti falešnému starému webu a skutečné databázi
  (náhled, import s fotkami, opakování, změny, zmizelé inzeráty, přesměrování, pozvánky). Běží i v GitHub kontrole.
