#!/usr/bin/env bash
# Obnova zálohy z GitHub Actions (artefakt db-backup-*) do databáze.
# Použití:  scripts/db-restore.sh <soubor.dump|soubor.dump.gpg> <cílová DATABASE_URL>
# Cíl by měla být NOVÁ/prázdná databáze (nebo testovací kopie) – skript schéma nemaže.
# Potřebuje pg_restore a psql (PostgreSQL 17 klient), u šifrované zálohy gpg.
set -euo pipefail
file="${1:?Zadejte soubor zálohy}"; target="${2:?Zadejte cílovou DATABASE_URL (přímé připojení, ne PgBouncer)}"
# Parametry Prismy (?schema=…, ?pgbouncer=…) libpq nezná – odstraníme je
target="$(printf '%s' "$target" | sed -E 's/([?&])(schema|pgbouncer|connection_limit|pool_timeout)=[^&]*&?/\1/g; s/[?&]$//')"
if [[ "$file" == *.gpg ]]; then
  out="${file%.gpg}"
  gpg --batch --yes --pinentry-mode loopback --decrypt -o "$out" "$file"   # zeptá se na BACKUP_PASSPHRASE
  file="$out"
fi
list="$(mktemp)"; trap 'rm -f "$list"' EXIT
pg_restore --list "$file" > "$list"   # kontrola archivu
# Schéma, které v cílové databázi už existuje (typicky public), nezakládáme znovu – jinak by obnova skončila chybou
while read -r schema; do
  if [ "$(psql "$target" -Atc "select 1 from pg_namespace where nspname = '$schema'")" = "1" ]; then
    sed -i -E "/ SCHEMA - $schema( |$)/d; / COMMENT - SCHEMA $schema( |$)/d" "$list"
  fi
done < <(sed -nE 's/^[0-9]+; [0-9]+ [0-9]+ SCHEMA - ([A-Za-z0-9_]+) .*/\1/p' "$list")
pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --use-list "$list" --dbname "$target" "$file"
echo "Hotovo. Ověřte počty, např. psql <cílová URL> -c 'select count(*) from app.\"Listing\"' (u schématu public bez „app.“)."
