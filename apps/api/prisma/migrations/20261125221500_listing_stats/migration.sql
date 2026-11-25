-- CreateTable
CREATE TABLE "ListingStatDay" (
    "listingId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "phoneReveals" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ListingStatDay_pkey" PRIMARY KEY ("listingId","day")
);

-- CreateIndex
CREATE INDEX "ListingStatDay_day_idx" ON "ListingStatDay"("day");

-- AddForeignKey
ALTER TABLE "ListingStatDay" ADD CONSTRAINT "ListingStatDay_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

