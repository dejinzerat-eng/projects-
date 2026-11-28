-- Reklamní bannery na úvodní stránce (řada 3 bannerů místo sekce „Nabídky v okolí“).
-- Jen nová tabulka – stávající data se nemění.
CREATE TABLE IF NOT EXISTS "Banner" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "alt" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Banner_active_position_idx" ON "Banner"("active", "position");
