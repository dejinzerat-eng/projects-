-- WP6: role a oprávnění, omezené účty, systémová nastavení, historie hlášení

-- AlterEnum (IF NOT EXISTS: migrace je bezpečná i při souběhu s jinou větví)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPERADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPPORT';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'BUSINESS_MANAGER';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'RESTRICTED';

-- AlterTable
ALTER TABLE "Report" ADD COLUMN "resolutionNote" TEXT;

-- AlterTable
-- companyVerifiedAt přidává už migrace 20261125232000 (ověření firmy přes ARES)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "companyVerifiedAt" TIMESTAMP(3),
ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- Výchozí hodnota aktivity = poslední přihlášení
UPDATE "User" SET "lastActiveAt" = "lastSeenAt" WHERE "lastActiveAt" IS NULL;

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "UserRestriction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt" TIMESTAMP(3),
    "liftedById" TEXT,
    "liftNote" TEXT,

    CONSTRAINT "UserRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserRestriction_userId_createdAt_idx" ON "UserRestriction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserRestriction_liftedAt_idx" ON "UserRestriction"("liftedAt");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");
