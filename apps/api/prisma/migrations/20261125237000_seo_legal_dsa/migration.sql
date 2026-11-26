-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('RECEIVED', 'ACTION_TAKEN', 'NO_ACTION');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'UPHELD', 'REJECTED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "intro" TEXT;

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "description" TEXT,
ADD COLUMN     "effectiveFrom" TIMESTAMP(3),
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "seededHash" TEXT;

-- CreateTable
CREATE TABLE "Redirect" (
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "code" INTEGER NOT NULL DEFAULT 308,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Redirect_pkey" PRIMARY KEY ("from")
);

-- CreateTable
CREATE TABLE "IllegalContentNotice" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "targetType" "ReportTarget",
    "targetId" TEXT,
    "explanation" TEXT NOT NULL,
    "reporterName" TEXT,
    "reporterEmail" TEXT,
    "reporterUserId" TEXT,
    "goodFaith" BOOLEAN NOT NULL,
    "status" "NoticeStatus" NOT NULL DEFAULT 'RECEIVED',
    "action" TEXT,
    "decisionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IllegalContentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAppeal" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "decisionReason" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAppeal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IllegalContentNotice_ref_key" ON "IllegalContentNotice"("ref");

-- CreateIndex
CREATE INDEX "IllegalContentNotice_status_createdAt_idx" ON "IllegalContentNotice"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationAppeal_ref_key" ON "ModerationAppeal"("ref");

-- CreateIndex
CREATE INDEX "ModerationAppeal_status_createdAt_idx" ON "ModerationAppeal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAppeal_listingId_idx" ON "ModerationAppeal"("listingId");

