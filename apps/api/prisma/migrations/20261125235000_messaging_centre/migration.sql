-- AlterEnum
-- IF NOT EXISTS: hodnotu může přidat i jiná migrace (sloučení větví)
ALTER TYPE "ReportTarget" ADD VALUE IF NOT EXISTS 'CONVERSATION';

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "buyerArchivedAt" TIMESTAMP(3),
ADD COLUMN     "directKey" TEXT,
ADD COLUMN     "sellerArchivedAt" TIMESTAMP(3),
ALTER COLUMN "listingId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "conversationId" TEXT;

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagePreference" (
    "userId" TEXT NOT NULL,
    "emailOnMessage" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessagePreference_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "MessageAttachment_messageId_key" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageAttachment_ownerId_createdAt_idx" ON "MessageAttachment"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

