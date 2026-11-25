-- Telefon jen se souhlasem (opt-in) a ověření firmy v ARES
ALTER TABLE "User" ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "companyVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "showPhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatId" TEXT;
