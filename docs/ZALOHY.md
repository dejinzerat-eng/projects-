# Zálohy a obnova

Stav k listopadu 2026. Podmínky Supabase se mění – před spuštěním ověřte aktuální ceník a dokumentaci (supabase.com/docs/guides/platform/backups).

## Co se zálohuje

| Data | Kde jsou | Záloha |
|---|---|---|
| Databáze (uživatelé, inzeráty, zprávy, oznámení DSA…) | Supabase PostgreSQL, schéma `app` | 1) zálohy Supabase (placený plán), 2) denní `pg_dump` přes GitHub Actions |
| Fotky inzerátů | Vercel Blob | Blob nemá verzování ani automatické zálohy – viz níže |
| Kód a migrace | GitHub | git |
| Proměnné prostředí | Vercel | ručně uložit do správce hesel (ne do repozitáře) |

## 1. Zálohy Supabase

- **Free plán:** žádné zálohy, které by šlo obnovit z administrace. Pro ostrý provoz nestačí.
- **Pro plán a vyšší:** automatická **denní záloha** (Pro uchovává 7 dní, Team 14 dní, Enterprise až 30 dní). Obnova: Dashboard → Database → Backups → *Restore*. Obnova přepíše aktuální databázi a projekt je po dobu obnovy nedostupný; jde zvolit i obnovu do nového projektu.
- **PITR (Point-in-Time Recovery):** placený doplněk k Pro plánu (vyžaduje alespoň výpočetní instanci Small). Archivuje WAL průběžně, takže lze obnovit stav k libovolné sekundě v okně 7, 14 nebo 28 dní. Se zapnutým PITR se denní zálohy nahrazují.
- Doporučení pro spuštění: **Pro plán + PITR 7 dní**. Chrání před chybou v migraci nebo omylem smazanými daty („vrátit na 10:42“).

Zálohy Supabase jsou ve stejném účtu jako databáze. Proto máme i nezávislou kopii mimo Supabase (níže).

## 2. Denní export přes GitHub Actions

Workflow `.github/workflows/db-backup.yml` každý den ve 02:17 UTC spustí `pg_dump` (PostgreSQL 17, formát custom, komprese 9), ověří, že archiv jde přečíst (`pg_restore --list`), volitelně ho zašifruje a uloží jako artefakt `db-backup-<datum>`. Spustit ho jde i ručně (Actions → Záloha databáze → Run workflow).

**Je vypnutý, dokud nenastavíte tajný klíč.** Nastavení v GitHubu: *Settings → Secrets and variables → Actions*:

| Název | Typ | Hodnota |
|---|---|---|
| `DATABASE_BACKUP_URL` | secret | **přímé** připojení (session mode, port 5432, ne PgBouncer 6543), ideálně role jen pro čtení, např. `postgresql://postgres.<ref>:<heslo>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require` |
| `BACKUP_PASSPHRASE` | secret | dlouhé náhodné heslo; záloha se zašifruje (gpg AES-256). Bez něj se uloží nešifrovaně a workflow vypíše varování. |
| `BACKUP_SCHEMA` | variable | výchozí `app`; `*` = celá databáze |
| `BACKUP_RETENTION_DAYS` | variable | výchozí 30 (GitHub povoluje max. 90) |

Heslo `BACKUP_PASSPHRASE` uložte i mimo GitHub (správce hesel) – bez něj zálohu nerozšifrujete.

Role jen pro čtení (spustit jednou v Supabase SQL editoru, heslo zvolte vlastní):

```sql
CREATE ROLE dej_backup LOGIN PASSWORD '<silné-heslo>';
GRANT USAGE ON SCHEMA app TO dej_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA app TO dej_backup;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA app TO dej_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO dej_backup;
```

## 3. Obnova

### Z artefaktu GitHub Actions

1. Actions → *Záloha databáze* → vybraný běh → stáhnout artefakt a rozbalit ZIP.
2. Připravit **novou prázdnou** databázi (nový Supabase projekt nebo lokální Postgres – `docker compose up -d postgres`). Obnovu nikdy nezkoušejte rovnou do produkce.
3. Spustit:
   ```bash
   scripts/db-restore.sh dejinzerat-2026-11-25T0217Z.dump.gpg "postgresql://uzivatel:heslo@host:5432/postgres"
   ```
   Skript zálohu rozšifruje (zeptá se na `BACKUP_PASSPHRASE`), ověří a nahraje v jedné transakci (při chybě se nic nezmění).
4. Ověřit data (počty uživatelů a inzerátů, poslední inzeráty) a teprve potom přepnout `DATABASE_URL` / `DIRECT_URL` ve Vercelu na obnovenou databázi a znovu nasadit.
5. Pokud je záloha starší než poslední migrace, `prisma migrate deploy` při nasazení chybějící migrace doplní.

### Ze zálohy Supabase / PITR

Dashboard → Database → Backups (nebo *Point in Time*) → zvolit čas → Restore. Poté zkontrolovat aplikaci; připojovací řetězce se nemění.

## 4. Fotky (Vercel Blob)

Vercel Blob nemá verzování ani koš. Smazané nebo přepsané soubory nejdou obnovit. Možnosti:
- přejít na S3 kompatibilní úložiště s verzováním (Cloudflare R2, AWS S3 – API už je podporuje přes `S3_*`),
- nebo pravidelně kopírovat Blob do jiného úložiště (`@vercel/blob` `list()` + stažení).

Fotky nejsou kritické pro obnovu provozu (inzeráty fungují i bez nich), proto mají nižší prioritu než databáze.

## 5. Pravidelný test obnovy

Jednou za čtvrtletí obnovte poslední artefakt do testovací databáze (kroky 1–4 bez přepnutí produkce), zapište datum a výsledek sem:

| Datum | Záloha | Kdo | Výsledek |
|---|---|---|---|
| – | – | – | – |
