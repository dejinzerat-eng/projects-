#!/usr/bin/env bash
# Obnova zálohy z GitHub Actions (artefakt db-backup-*) do databáze.
# Použití:  scripts/db-restore.sh <soubor.dump|soubor.dump.gpg> <cílová DATABASE_URL>
# Cíl by měla být NOVÁ/prázdná databáze (nebo testovací kopie) – skript schéma nemaže.
set -euo pipefail
file="${1:?Zadejte soubor zálohy}"; target="${2:?Zadejte cílovou DATABASE_URL (přímé připojení, ne PgBouncer)}"
if [[ "$file" == *.gpg ]]; then
  out="${file%.gpg}"
  gpg --batch --yes --pinentry-mode loopback --decrypt -o "$out" "$file"   # zeptá se na BACKUP_PASSPHRASE
  file="$out"
fi
pg_restore --list "$file" > /dev/null   # kontrola archivu
pg_restore --no-owner --no-privileges --exit-on-error --single-transaction --dbname "$target" "$file"
echo "Hotovo. Ověřte počty: psql \"$target\" -c 'select count(*) from app.\"Listing\"' (nebo bez app. u schématu public)."
