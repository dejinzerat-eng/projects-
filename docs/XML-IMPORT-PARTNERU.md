# Import nabídek partnerů přes XML feed

Bezplatná spolupráce s menšími autobazary, realitními kancelářemi a e-shopy: jejich nabídky se automaticky
přenášejí z XML feedu, který už většinou mají (pro Heureku, Zboží.cz, Google Nákupy nebo z autobazarového či
realitního softwaru). Web se tak legálně plní skutečnými nabídkami a partner získá zákazníky a odkaz na svůj web.

Kód: `apps/api/src/feeds` (čtení feedu, převod, synchronizace), administrace `apps/web/src/app/admin/partneri`.

## Jak přidat partnera (administrace)

1. **Administrace › Partneři a XML import › Přidat partnera** (role Správce obchodních účtů, Administrátor, Hlavní administrátor).
2. Vyplňte název, **adresu XML feedu** a e-mail partnera. Zvolte, zda založit **nový firemní účet** (bez hesla), nebo použít účet, který partner už má.
3. **Načíst náhled** ukáže, kolik nabídek feed má, do jakých kategorií půjdou, ceny, místa, fotky a parametry. Nic se neukládá.
4. **Založit partnera** → v detailu partnera:
   - **Náhled a přiřazení kategorií**: ke každé kategorii z feedu lze vybrat naši (jinak se odhadne podle názvu a parametrů).
     V části „Přiřazení polí feedu“ lze opravit, které pole feedu je název, cena, fotky, značka, rok výroby… (většinou není potřeba).
   - **Uložit nastavení** a **Synchronizovat teď**. První import stáhne a zmenší fotky, u větších feedů trvá několik minut (ukazuje průběh, po přerušení stačí spustit znovu).
   - Nové nabídky ve výchozím stavu **čekají na schválení**. Po kontrole je schválíte jedním tlačítkem **Schválit čekající**.
     Jakmile partnerovi důvěřujete, zrušte volbu „Nové nabídky schvalovat ručně“.
5. **Poslat partnerovi přístup**: e-mail s odkazem na nastavení hesla (platí 14 dní). Funguje až po nastavení e-mailů (Resend) na ostré doméně.

## Co synchronizace dělá

| Situace | Co se stane |
|---|---|
| Nová nabídka ve feedu | Nový inzerát pod firemním účtem partnera (fotky zmenšené na 1600 px + náhled, uložené u nás). |
| Nabídka se ve feedu změnila (cena, text, fotky…) | Inzerát se aktualizuje. Schválený inzerát zůstane zveřejněný. |
| Inzerát u nás upravil moderátor nebo partner | Synchronizace ho **nepřepíše** (v historii jako „nepřepsané“). |
| Moderátor inzerát zamítl nebo smazal, partner ho označil jako prodaný | Zůstane, jak je. |
| Nabídka z feedu zmizela | Inzerát se stáhne (stav „vypršelý“). Když se do feedu vrátí, znovu se zveřejní. |
| Nabídka stále ve feedu | Platnost inzerátu se průběžně prodlužuje. |
| Feed nejde stáhnout / není XML | Nic se nemění, v historii je chyba s vysvětlením. |
| Feed má najednou méně než polovinu nabídek | Z opatrnosti se nic nestahuje (rozbitý export). Po kontrole lze použít tlačítko **Stáhnout chybějící**. |
| Podezřelý obsah (běžná automatická kontrola: půjčky, podvody, léky…) | Inzerát vždy čeká na schválení. |

Duplicity nevzniknou: každý inzerát je svázaný s ID nabídky ve feedu (unikátní `feedId + feedItemId`).
Inzerát má odkaz **„Nabídka na webu prodejce“** (`rel="nofollow"`), pokud feed obsahuje odkaz na nabídku.

**Automatická synchronizace:** podle intervalu partnera (výchozí jednou denně). Na Vercelu ji spouští denní cron
(`/api/jobs/tick`, 6:00 UTC), jeden běh zpracuje nejvýše ~35 s práce – velké změny se dokončí v dalších bězích, nebo
ručně tlačítkem. Kratší intervaly (6 nebo 12 hodin) mají smysl jen s častějším spouštěním (Vercel Pro nebo jiný plánovač).

## Podporované formáty

Formát se rozpozná sám (lze ho i vybrat ručně):

- **Heureka / Zboží.cz** (`<SHOP><SHOPITEM>`): `ITEM_ID`, `PRODUCTNAME`, `DESCRIPTION`, `URL`, `IMGURL`, `IMGURL_ALTERNATIVE`,
  `PRICE_VAT`, `CATEGORYTEXT`, `MANUFACTURER`, `ITEM_TYPE` (new/bazaar), parametry `PARAM` (`PARAM_NAME` + `VAL`).
  Tento export má skoro každý e-shop (Shoptet, Upgates, WooCommerce…).
- **Google Nákupy / Merchant Center** (RSS `item` nebo Atom `entry` s poli `g:id`, `g:title`, `g:price`, `g:image_link`, `g:condition`, `g:product_type`…).
- **Obecné XML** – autobazarový a realitní software, vlastní export. Najde se opakující se element s nabídkami a pole se
  přiřadí podle názvů (česky i anglicky: `znacka`/`make`, `rok_vyroby`/`year`, `najeto`/`mileage`, `palivo`/`fuel`,
  `dispozice`, `uzitna_plocha`, `vlastnictvi`, `PENB`…), včetně parametrů ve tvaru `<parametr nazev="Rok výroby">2018</parametr>`.
  Pokud se něco nepřiřadí správně, opravíte to v administraci.

Feed může být v UTF-8 i windows-1250 / ISO-8859-2, může být komprimovaný (gzip) a chráněný heslem
(`https://jmeno:heslo@partner.cz/feed.xml`). Limit: 50 MB, výchozí nejvýše 1000 nabídek na partnera (nastavitelné až 10 000).

Sauto.cz a Sreality.cz používají pro import jiné rozhraní (XML-RPC), takže partner, který tam inzeruje, potřebuje
z autobazarového/realitního softwaru **XML export** – většina programů ho umí, případně stačí formát níže.

### Doporučený formát pro partnery bez feedu („DEJINZERAT XML“)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<inzeraty>
  <inzerat>
    <id>A-1024</id>                      <!-- stálé ID nabídky (povinné) -->
    <nazev>Škoda Octavia Combi 2.0 TDI</nazev>
    <popis>Servisní knížka, 1. majitel…</popis>
    <cena>289000</cena>                  <!-- Kč; prázdné = dohodou -->
    <kategorie>Osobní automobily</kategorie>
    <typ_nabidky>prodej</typ_nabidky>    <!-- prodej / pronájem -->
    <stav>ojeté</stav>                   <!-- nové / jako nové / použité / poškozené -->
    <mesto>Brno</mesto>
    <psc>60200</psc>
    <url>https://www.partner.cz/nabidka/1024</url>
    <foto>https://www.partner.cz/foto/1024-1.jpg</foto>
    <foto>https://www.partner.cz/foto/1024-2.jpg</foto>
    <parametr nazev="Značka">Škoda</parametr>
    <parametr nazev="Rok výroby">2018</parametr>
    <parametr nazev="Najeto">125000</parametr>
    <parametr nazev="Palivo">nafta</parametr>
    <parametr nazev="Převodovka">manuální</parametr>
  </inzerat>
</inzeraty>
```

Parametry, které umíme převést na filtry webu: auto-moto (značka, rok výroby, najeto, palivo, převodovka, karoserie, výkon v kW
nebo koních), reality (dispozice, užitná plocha, vlastnictví, energetická třída, prodej/pronájem), oblečení a obuv (velikost).

## Bezpečnost a osobní údaje

- Feed i fotky se stahují jen z veřejných adres (ne z vnitřní sítě), s limitem velikosti a času; vlastní entity v XML se nerozbalují.
- Inzeráty patří firemnímu účtu partnera; partner se po nastavení hesla přihlásí a vidí zprávy od zájemců.
- Doporučení: se spoluprací mít od partnera souhlas (stačí e-mail) – šablona níže.

## Testy

- `apps/api/src/feeds/feed.spec.ts` – čtení formátů (Heureka, Google, obecné XML ve windows-1250), přiřazení polí, ceny, parametry, kategorie, bezpečnost adres.
- `pnpm --filter @dej/api feeds:e2e` – celý průběh proti falešnému webu partnera a skutečné databázi (náhled, založení, synchronizace po dávkách,
  schválení, opakování bez duplicit, změny, úprava moderátorem, rozbitý feed, zmizelé a vrácené nabídky, rizikový obsah, cron, pozvánka, smazání). Běží i v GitHub kontrole.

## Šablona e-mailu pro oslovení partnerů

> **Předmět:** Bezplatné zveřejnění vašich nabídek na DEJINZERAT.cz
>
> Dobrý den,
>
> provozujeme inzertní portál DEJINZERAT.cz a rádi bychom na něm zdarma zveřejňovali i vaše nabídky.
> Nemusíte nic přepisovat ani vkládat ručně – stačí nám poslat odkaz na XML feed, který už nejspíš máte
> (např. pro Heureku, Zboží.cz, Google Nákupy nebo export z autobazarového či realitního programu).
>
> Co z toho máte:
> - nabídky se u nás objeví automaticky a každý den se aktualizují (ceny, prodané vozy/nemovitosti/zboží zmizí samy),
> - u každé nabídky je odkaz na váš web a zájemci vám mohou psát přímo přes portál,
> - vše je zdarma a spolupráci můžete kdykoli ukončit jedním e-mailem.
>
> Pokud máte zájem, pošlete nám prosím odkaz na feed a e-mail, pod kterým má být váš firemní účet.
> Rádi pomůžeme i s nastavením, pokud feed zatím nemáte.
>
> Děkujeme a přejeme hezký den
> [Jméno], DEJINZERAT.cz
> [telefon] · [e-mail]
