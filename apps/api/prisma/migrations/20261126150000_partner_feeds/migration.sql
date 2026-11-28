-- XML import nabídek partnerů (autobazary, realitní kanceláře, e-shopy): feedy, historie synchronizací a vazba inzerátů na položky feedu
-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "feedHash" TEXT,
ADD COLUMN     "feedId" TEXT,
ADD COLUMN     "feedItemId" TEXT,
ADD COLUMN     "sourceUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "partnerInvitedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PartnerFeed" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'auto',
    "fieldMap" JSONB NOT NULL DEFAULT '{}',
    "categoryMap" JSONB NOT NULL DEFAULT '{}',
    "defaultCategoryId" TEXT,
    "defaultCity" TEXT,
    "defaultZip" TEXT,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "intervalHours" INTEGER NOT NULL DEFAULT 24,
    "maxItems" INTEGER NOT NULL DEFAULT 1000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastMessage" TEXT,
    "nextSyncAt" TIMESTAMP(3),
    "currentRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerFeedRun" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'running',
    "items" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "removed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "problems" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "PartnerFeedRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerFeed_active_nextSyncAt_idx" ON "PartnerFeed"("active", "nextSyncAt");

-- CreateIndex
CREATE INDEX "PartnerFeedRun_feedId_startedAt_idx" ON "PartnerFeedRun"("feedId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_feedId_feedItemId_key" ON "Listing"("feedId", "feedItemId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "PartnerFeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerFeed" ADD CONSTRAINT "PartnerFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerFeedRun" ADD CONSTRAINT "PartnerFeedRun_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "PartnerFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

