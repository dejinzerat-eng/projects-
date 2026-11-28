-- Značka se píše „DEJINZERAT.cz“ (dříve „Dejinzerat.cz“). Přepíše se jen tento zápis v textech –
-- adresy (www.dejinzerat.cz), e-maily (…@dejinzerat.cz) ani jiný obsah se nemění. Opakovatelné:
-- po prvním spuštění už nic neodpovídá podmínce WHERE. Stránky (Page) přepisuje seed (kvůli otisku textu).

UPDATE "Category" SET
  "seoTitle"       = replace("seoTitle", 'Dejinzerat.cz', 'DEJINZERAT.cz'),
  "seoDescription" = replace("seoDescription", 'Dejinzerat.cz', 'DEJINZERAT.cz'),
  "intro"          = replace("intro", 'Dejinzerat.cz', 'DEJINZERAT.cz')
WHERE "seoTitle" LIKE '%Dejinzerat.cz%' OR "seoDescription" LIKE '%Dejinzerat.cz%' OR "intro" LIKE '%Dejinzerat.cz%';

UPDATE "PriceItem" SET
  "name"        = replace("name", 'Dejinzerat.cz', 'DEJINZERAT.cz'),
  "description" = replace("description", 'Dejinzerat.cz', 'DEJINZERAT.cz')
WHERE "name" LIKE '%Dejinzerat.cz%' OR "description" LIKE '%Dejinzerat.cz%';

UPDATE "Setting" SET "value" = replace("value"::text, 'Dejinzerat.cz', 'DEJINZERAT.cz')::jsonb
WHERE "value"::text LIKE '%Dejinzerat.cz%';

-- Poznámka, kterou import doplnil ke krátkým popisům inzerátů ze starého webu
UPDATE "Listing" SET
  "description" = replace("description", '(Inzerát převzatý ze starého webu Dejinzerat.cz.)', '(Inzerát převzatý ze starého webu DEJINZERAT.cz.)')
WHERE "description" LIKE '%(Inzerát převzatý ze starého webu Dejinzerat.cz.)%';
