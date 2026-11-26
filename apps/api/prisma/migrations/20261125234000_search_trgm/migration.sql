CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Vyhledávání v PostgreSQL: normalizovaný text (malá písmena bez diakritiky) s trigram indexem.
-- unaccent se nepoužívá (není IMMUTABLE); sloupec plní aplikace, staré řádky doplní translate()/lower().
ALTER TABLE "Listing" ADD COLUMN "searchText" TEXT NOT NULL DEFAULT '';

UPDATE "Listing" l SET "searchText" = left(btrim(regexp_replace(lower(translate(concat_ws(' ', l."title", l."description", (SELECT string_agg(e.v, ' ') FROM (SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(x.value) = 'array' THEN x.value ELSE jsonb_build_array(x.value) END) AS v FROM jsonb_each(CASE WHEN jsonb_typeof(l."attributes") = 'object' THEN l."attributes" ELSE '{}'::jsonb END) x WHERE jsonb_typeof(x.value) IN ('string', 'number', 'array')) e), l."city"), 'áäàâãåčćçďéěëèêíïìîĺľłňńñóöôòõőŕřšśťúůüùûűýÿžźżÁÄÀÂÃÅČĆÇĎÉĚËÈÊÍÏÌÎĹĽŁŇŃÑÓÖÔÒÕŐŔŘŠŚŤÚŮÜÙÛŰÝŸŽŹŻ', 'aaaaaacccdeeeeeiiiilllnnnoooooorrsstuuuuuuyyzzzAAAAAACCCDEEEEEIIIILLLNNNOOOOOORRSSTUUUUUUYYZZZ')), '[^a-z0-9]+', ' ', 'g')), 12000);

-- Třída operátorů se uvádí se schématem rozšíření: Prisma nastaví search_path jen na schéma aplikace
-- a na Supabase je pg_trgm ve schématu „extensions“.
DO $$
DECLARE s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  EXECUTE format('CREATE INDEX "Listing_searchText_idx" ON "Listing" USING GIN ("searchText" %I.gin_trgm_ops)', s);
END $$;

-- Řazení a filtr podle data zveřejnění, předfiltr vzdálenosti
CREATE INDEX "Listing_status_publishedAt_idx" ON "Listing"("status", "publishedAt");
CREATE INDEX "Listing_lat_lng_idx" ON "Listing"("lat", "lng");

-- Oblíbené podle inzerátu, uložená hledání podle uživatele
CREATE INDEX "Favorite_listingId_idx" ON "Favorite"("listingId");
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");
