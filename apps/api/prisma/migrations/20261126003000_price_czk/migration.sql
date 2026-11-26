-- Cena přepočtená na Kč pro řazení a filtr ceny (EUR kurzem z nastavení eurRate, výchozí 25)
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "priceCzk" INTEGER;

UPDATE "Listing" SET "priceCzk" = CASE
  WHEN "price" IS NULL THEN NULL
  WHEN "currency" = 'EUR' THEN LEAST(2147483647, ROUND("price" * COALESCE(
    (SELECT CASE WHEN jsonb_typeof("value") = 'number' AND ("value")::text::numeric > 0 THEN ("value")::text::numeric END FROM "Setting" WHERE "key" = 'eurRate'),
    25)))::int
  ELSE "price"
END;

CREATE INDEX IF NOT EXISTS "Listing_status_priceCzk_idx" ON "Listing"("status", "priceCzk");
