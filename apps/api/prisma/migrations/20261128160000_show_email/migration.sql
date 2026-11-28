-- Zobrazení e-mailu prodejce u inzerátů. NULL = prodejce se ještě nerozhodl (e-mail se neukazuje),
-- true/false = jeho volba v průvodci inzerátem nebo v nastavení. Jen přidání sloupce, data se nemění.
ALTER TABLE "User" ADD COLUMN "showEmail" BOOLEAN;
