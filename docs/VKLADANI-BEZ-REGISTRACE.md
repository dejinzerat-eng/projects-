# Vložení inzerátu bez předchozí registrace

Návštěvník může vložit inzerát hned, bez registrace. Účet se mu založí automaticky z e-mailu, který zadá v posledním kroku formuláře.

## Jak to funguje pro uživatele

1. Klikne na **Přidat inzerát** (`/pridat`) a vyplní průvodce jako obvykle: název a kategorie, fotky, popis a cena, místo.
2. V posledním kroku (**Náhled**) zadá **e-mail**, **jméno** (zobrazí se u inzerátu) a zaškrtne souhlas s podmínkami používání, pravidly inzerování a zpracováním osobních údajů. Když je zapnutá CAPTCHA (Cloudflare Turnstile), potvrdí i „Nejsem robot“.
3. Po kliknutí na **Zveřejnit** uvidí „Zkontrolujte svůj e-mail“. Inzerát je uložený, ale zatím **není veřejný**.
4. V e-mailu klikne na **Potvrdit e-mail a zveřejnit inzerát** → otevře se `/potvrzeni-inzeratu` a tam klikne na tlačítko. Tím se:
   - ověří e-mail a založí (aktivuje) účet,
   - uživatel přihlásí,
   - inzerát zveřejní (nebo pošle ke schválení moderátorovi, pokud je zapnutá předběžná moderace nebo inzerát vyhodnotí automatická kontrola jako rizikový).
5. Na stejné stránce si může rovnou **nastavit heslo** (doporučené, ale nepovinné). Později ho nastaví v Nastavení účtu nebo přes Zapomenuté heslo.

Odkaz platí 3 dny a jde použít jen jednou. Bez kliknutí se nic nezveřejní.

### Když e-mail už má účet

Inzerát **nezmizí** – zůstane ve formuláři a pod ním se objeví rámeček „S e-mailem … už u nás máte účet“ se dvěma možnostmi:

1. **Heslo přímo ve formuláři** → tlačítko **Přihlásit a zveřejnit**. Uživatel se přihlásí a inzerát se hned zveřejní v jeho účtu (i s fotkami). Pokud účet ještě neodsouhlasil aktuální podmínky, použije se souhlas zaškrtnutý ve formuláři.
2. **Poslat odkaz na e-mail** (když heslo nemá nebo ho neví). Na adresu účtu přijde odkaz „Zveřejnit inzerát v mém účtu“. Po kliknutí se inzerát uloží a zveřejní v účtu a uživatel se přihlásí – funguje to i v jiném zařízení (např. odkaz otevřený v telefonu).

Do cizího účtu se **nic nezapíše bez kliknutí majitele e-mailu**: inzerát mezitím čeká v jednorázovém tokenu (`VerificationToken.target = "pending:{…}"`), ne v účtu. Kdo zadá cizí e-mail, nic nezveřejní – majitel jen dostane e-mail, který může ignorovat.

Další možnost je odkaz **Přihlásit se jinak** (Google/Apple, zapomenuté heslo) – rozepsaný inzerát si pamatuje prohlížeč a po přihlášení se do formuláře vrátí.

Výjimka: účet založený dřív stejným způsobem, ale nikdy nepotvrzený (bez hesla, bez Google/Apple, nepřevzatý ze starého webu). Takový účet ještě nikdo „nevlastní“, proto se k němu další inzerát přidá a přijde další potvrzovací odkaz – každý inzerát má svůj.

Účty převzaté ze starého webu (importované inzeráty) se tímto formulářem nemění; jejich majitelé se přihlásí přes pozvánku nebo Zapomenuté heslo.

## Ochrana proti zneužití

| Ochrana | Hodnota | Kde |
|---|---|---|
| CAPTCHA (Turnstile) | když jsou nastavené `TURNSTILE_SECRET` a `TURNSTILE_SITE_KEY` | `POST /listings/guest` |
| Inzeráty bez přihlášení z jedné IP | 5 za hodinu (+ nejvýš 5 pokusů za minutu) | `apps/api/src/listings/guest.ts` |
| Potvrzovací e-maily na jednu adresu | 3 za hodinu (ochrana cizí schránky) | tamtéž |
| Fotky bez přihlášení | 60 za den na prohlížeč, 180 na IP | tamtéž |
| Kontrola obsahu | stejná jako u běžného zveřejnění: zakázaný obsah, duplicity, podezřelá cena, limity, omezené účty, předběžná moderace | `ListingsService` |
| Zveřejnění | až po ověření e-mailu kliknutím (POST tlačítkem, aby odkaz neotevřela automatická kontrola pošty) | `/potvrzeni-inzeratu` |

## Technicky

- **Fotky bez přihlášení**: `POST /media/image` funguje i bez přihlášení. Prohlížeč dostane náhodný token v cookie `dej_guest` (httpOnly, 7 dní) a fotka se uloží s vlastníkem `guest:<sha256 tokenu>` (token sám v databázi není). Po odeslání inzerátu nebo po přihlášení se vybrané fotky převedou na účet (`ListingsService.claimGuestImages`). Cizí prohlížeč si je přivlastnit nemůže.
- **Odeslání**: `POST /listings/guest` – tělo jako `POST /listings` + `email`, `name`, `terms: true`, `captcha`. Ověří inzerát (včetně kategorie a parametrů) **před** založením účtu, založí účet bez hesla (`termsAcceptedAt`, `termsVersion`, audit `auth.register` s `method: guest_listing`), uloží inzerát jako koncept (`DRAFT`) a pošle e-mail. Existující účet → `409` s `code: ACCOUNT_EXISTS`; s `existingAccount: "link"` se místo toho pošle odkaz majiteli účtu (inzerát čeká v tokenu, do účtu se zapíše až po kliknutí).
- **Potvrzení**: `POST /listings/guest/confirm { token }` – token je `VerificationToken` typu `EMAIL_VERIFY` s cílem `listing:<id>`. Ověří e-mail (audit `auth.email_verify`), vytvoří přihlášení (audit `auth.login`, `method: email_link`) a zavolá `ListingsService.publishDraft` (stejné kontroly jako ruční zveřejnění). Když zveřejnění neprojde (např. limit), e-mail i přihlášení platí a inzerát zůstane v konceptech s vysvětlením.
- **Web**: `apps/web/src/app/pridat/page.tsx` (bez přihlášení vykreslí průvodce s `guest`), `apps/web/src/components/listing-wizard.tsx` (kontaktní údaje v náhledu, obrazovka „Zkontrolujte e-mail“, převzetí rozepsaného inzerátu po přihlášení), `apps/web/src/app/potvrzeni-inzeratu/page.tsx` + `apps/web/src/components/guest-confirm.tsx`.
- **Bez změny databáze** – žádná migrace.
- **Vývoj bez Resend**: mimo produkci API vrátí odkaz z e-mailu i v odpovědi (`devLink`) a obrazovka „Zkontrolujte e-mail“ ho ukáže, aby šel průběh vyzkoušet bez odesílání e-mailů. V produkci (`NODE_ENV=production`, tedy i na Vercelu) se odkaz nikdy nevrací.

## Testy

- Jednotkové: `apps/api/src/listings/guest.spec.ts` (rozhodnutí o účtu, vlastník fotek, token, validace formuláře).
- Celý průběh proti databázi a falešnému Resend: `pnpm --filter @dej/api guest:e2e` (`apps/api/scripts/guest-e2e.mjs`) – fotka bez přihlášení, odeslání, koncept, e-mail, potvrzení, přihlášení, heslo, existující účet, převzetí fotek po přihlášení, limity a neplatná kategorie. Spouští ho i GitHub kontrola (CI).

## Co je potřeba pro ostrý provoz

- **Odesílání e-mailů (Resend)**: bez `RESEND_API_KEY` se e-maily jen zapisují do logu a potvrzovací odkaz nikomu nepřijde. Resend se nastaví spolu s vlastní doménou.
- **CAPTCHA**: doporučujeme před spuštěním nastavit `TURNSTILE_SECRET` a `TURNSTILE_SITE_KEY` (Cloudflare Turnstile, zdarma).
