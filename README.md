# Dejinzerat.cz

Moderní inzertní portál pro ČR a SR. Monorepo:

| Složka | Co obsahuje |
|---|---|
| `apps/web` | Web – Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| `apps/api` | Backend – NestJS 11, Prisma 6, PostgreSQL, Meilisearch, Redis, S3 |
| `packages/shared` | Sdílený kód: kategorie a jejich filtry, lokality, parser chytrého hledání |
| `docs/` | Architektura a plán rozvoje, import ze starého webu (`docs/IMPORT-STAREHO-WEBU.md`), vložení inzerátu bez registrace (`docs/VKLADANI-BEZ-REGISTRACE.md`), import nabídek partnerů z XML feedu (`docs/XML-IMPORT-PARTNERU.md`) |

## Rychlý start (vývoj)

```bash
docker compose up -d            # PostgreSQL, Redis, Meilisearch, MinIO
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter @dej/shared build
cd apps/api && npx prisma migrate deploy && pnpm build && pnpm seed && cd ../..
pnpm dev                        # web: http://localhost:3000, API: http://localhost:4000
```

Skripty API (`dev`, `start`, `seed`, `smoke`) si samy načtou `apps/api/.env`, pokud existuje (Node 22 `--env-file-if-exists`).

## Testy a kontrola na GitHubu

```bash
pnpm --filter @dej/shared build && pnpm --filter @dej/api build
pnpm test                         # jednotkové testy (apps/api/src/**/*.spec.ts)
pnpm --filter @dej/api smoke      # zkušební spuštění API nad databází s výchozími daty
pnpm --filter @dej/api guest:e2e  # celý průběh „inzerát bez registrace“ (falešný Resend, po sobě uklidí)
pnpm --filter @dej/api feeds:e2e  # import z XML feedu partnera (falešný web partnera)
```

GitHub Actions (`.github/workflows/ci.yml`) spustí u každého pull requestu a pushe do `main`: instalaci, sestavení, testy, migrace a seed nad čistou databází, zkušební spuštění API, zabalení API pro Vercel a sestavení webu. Nepotřebuje žádné tajné klíče.

Po seedu existují účty:
- `admin@dejinzerat.cz` / `Admin12345` (administrátor – **v produkci změňte**, nebo nastavte `ADMIN_PASSWORD` před seedem)
- `demo1@dejinzerat.cz` … `demo10@dejinzerat.cz` / `Heslo1234` (ukázkoví prodejci)

Po prvním spuštění se v administraci (Přehled → nebo `POST /admin/reindex`) přeindexuje vyhledávání; API to při startu dělá samo, když je index prázdný.

## Proměnné prostředí API (`apps/api/.env`)

| Proměnná | Význam |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `REDIS_URL` | Redis (cache, zámky úloh, limity). Bez něj se použije paměť. |
| `MEILI_URL`, `MEILI_KEY` | Meilisearch. Bez něj se hledá v PostgreSQL (bez oprav překlepů). |
| `WEB_ORIGIN` | Adresa webu (CORS, odkazy v e-mailech) |
| `S3_*` | S3 kompatibilní úložiště fotek (AWS, Cloudflare R2, Supabase Storage, MinIO). Bez nich lokální disk. |
| `RESEND_API_KEY`, `MAIL_FROM` | Odesílání e-mailů. Bez klíče se e-maily jen logují. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Přihlášení přes Google |
| `TURNSTILE_SECRET`, `TURNSTILE_SITE_KEY` | CAPTCHA (Cloudflare Turnstile) |
| `PREMODERATION=1` | Všechny inzeráty čekají na schválení |
| `COOKIE_SECURE=1` | Zapnout na HTTPS |
| `OPERATOR_NAME`, `OPERATOR_ICO`, `OPERATOR_ADDRESS`, `OPERATOR_REGISTRY`, `OPERATOR_EMAIL`, `OPERATOR_PHONE`, `OPERATOR_DSA_EMAIL` | Identifikace provozovatele v e-mailech (oznámení DSA). Stejné proměnné čte i web (patička, Kontakt, právní texty), pokud je nemá v systémových nastaveních. |

Web (`apps/web/.env.local`): `API_INTERNAL_URL`, `NEXT_PUBLIC_SITE_URL`, `NOINDEX=1` pro testovací prostředí, `OPERATOR_*` (viz výše).

## Nasazení (dočasná verze)

- Hosting: Vercel, tým `dejinzerat-5803`, projekt `dejinzerat` (Root Directory `apps/web`). Každý push do větve `main` se nasadí automaticky.
- API (NestJS) běží na Vercelu uvnitř webu: `apps/web/src/pages/api/[...path].ts` načítá zabalené API z `apps/web/.api/server.js` (vytváří `pnpm --filter @dej/api vercel-build`).
- Databáze: Supabase PostgreSQL (pooler aws-0-eu-central-1, role `dej_app`), schéma `app`. Migrace a výchozí data se spouští při sestavení.
- Fotky: Vercel Blob (`BLOB_READ_WRITE_TOKEN`). Hledání bez Meilisearch běží v PostgreSQL.
- Proměnné prostředí jsou jen ve Vercelu (DATABASE_URL, DIRECT_URL, CRON_SECRET, ADMIN_PASSWORD, COOKIE_SECURE, DISABLE_JOBS, NOINDEX).

## SEO

- Každá veřejná stránka má titulek, popis, kanonickou adresu, Open Graph a Twitter kartu; výchozí obrázek pro sdílení kreslí `apps/web/src/app/opengraph-image.tsx`.
- Stránkování výpisů (`?strana=N`) má vlastní kanonickou adresu; kombinace filtrů, prázdné lokality a soukromé části (účet, zprávy, administrace, přidání inzerátu, přihlášení, hledání) mají `noindex`.
- Strukturovaná data podle typu obsahu (`apps/web/src/lib/jsonld.ts`): Product, Car/Vehicle/Motorcycle (auto-moto), RealEstateListing (reality), JobPosting (práce), Service (služby), BreadcrumbList, ItemList (výpisy), WebSite + SearchAction a Organization (úvod), Person/Organization s hodnocením (profil).
- Sitemapa: index `/sitemap.xml` → `/sitemap/static.xml` (úvod, kategorie z databáze, lokality, informační stránky), `/sitemap/inzeraty-N.xml` (všechny aktivní inzeráty po 10 000) a `/sitemap/profily-N.xml`. Data dává API `GET /seo/sitemap*`.
- Lokální vstupní stránky: `/lokalita/praha`, `/kategorie/elektronika/mesto/brno`, `/kategorie/reality/byty/mesto/ostrava`.
- Smazané, zamítnuté a dávno neaktivní inzeráty se trvale (308) přesměrují do své kategorie (`?odstraneno=1` zobrazí vysvětlení). Neznámé adresy kategorií a stránek se dohledají v tabulce přesměrování (Administrace → SEO).

## Právní texty a DSA

- Seed vytvoří návrhy stránek Podmínky používání, Zásady zpracování osobních údajů, Pravidla inzerování, Nahlašování nezákonného obsahu, Cookies, Kontakt, Informace pro spotřebitele, Podmínky placených služeb a Nápověda (`apps/api/src/seed-pages.ts`). **Jsou to návrhy – před spuštěním je musí zkontrolovat právník.** Seed nikdy nepřepíše text, který správce upravil (mění jen původní zástupné texty a neupravená znění ze seedu).
- Texty používají jednoduchý Markdown a značky `{{provozovatel}}`, `{{ico}}`, `{{sidlo}}`, `{{rejstrik}}`, `{{email}}`, `{{telefon}}`, `{{dsa_email}}`, které web nahradí údaji provozovatele (systémová nastavení → proměnné `OPERATOR_*` → zástupný text v hranatých závorkách).
- Oznámení nezákonného obsahu (čl. 16 DSA): veřejný formulář `/nahlasit-obsah` (i bez účtu, číslo oznámení + potvrzení e-mailem), vyřizování v Administrace → Nezákonný obsah (rozhodnutí s odůvodněním se pošle oznamovateli i autorovi), námitky autorů `/namitka` (čl. 20) a roční statistiky pro zprávu o transparentnosti.

## Zálohy

Podrobně v [docs/ZALOHY.md](docs/ZALOHY.md). Shrnutí:
- **Supabase:** Free plán zálohy nemá. Pro plán dělá denní zálohy (7 dní), doplněk **PITR** umožní obnovu k libovolné sekundě (7–28 dní). Pro ostrý provoz doporučujeme Pro + PITR.
- **Nezávislá kopie:** `.github/workflows/db-backup.yml` každý den spustí `pg_dump` a uloží (volitelně zašifrovaný) artefakt na 30 dní. Zapne se sám, jakmile v GitHubu nastavíte secret `DATABASE_BACKUP_URL` (a doporučeně `BACKUP_PASSPHRASE`).
- **Obnova:** `scripts/db-restore.sh <záloha> <cílová DATABASE_URL>` – vždy nejdřív do nové databáze, ověřit a pak přepnout proměnné ve Vercelu.
- Fotky ve Vercel Blob nemají verzování – viz docs/ZALOHY.md.

