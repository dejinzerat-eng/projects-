-- Import ze starého webu www.dejinzerat.cz: vazba na původní inzeráty a účty (jen přidané sloupce, bez změny dat)
ALTER TABLE "User" ADD COLUMN "legacyId" TEXT;
ALTER TABLE "User" ADD COLUMN "legacyInvitedAt" TIMESTAMP(3);
ALTER TABLE "Listing" ADD COLUMN "legacyId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "legacyHash" TEXT;
CREATE UNIQUE INDEX "User_legacyId_key" ON "User"("legacyId");
CREATE UNIQUE INDEX "Listing_legacyId_key" ON "Listing"("legacyId");
