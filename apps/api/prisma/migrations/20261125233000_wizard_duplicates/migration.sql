-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "composeSeconds" INTEGER,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "riskReasons" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ListingImage" ADD COLUMN     "phash" BIGINT;

-- CreateIndex
CREATE INDEX "Listing_contentHash_idx" ON "Listing"("contentHash");

-- CreateIndex
CREATE INDEX "ListingImage_phash_idx" ON "ListingImage"("phash");


-- Dar (Daruji) nemá cenu: zobrazuje se vždy jako „Zdarma“
UPDATE "Listing" SET "price" = NULL, "priceNegotiable" = false WHERE "offerType" = 'GIVE';

-- Koncepty nemají platnost, dokud nejsou zveřejněné
UPDATE "Listing" SET "expiresAt" = NULL WHERE "status" = 'DRAFT';
