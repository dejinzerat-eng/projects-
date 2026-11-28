-- Další zápisy značky („DEJinzerat.cz“, „DEJINZERAT.CZ“, „DejInzerat.cz“…) → „DEJINZERAT.cz“.
-- Nemění malá písmena („dejinzerat.cz“) ani značku uvnitř adresy nebo e-mailu (před ní „.“, „/“, „@“ apod.).
-- Opakovatelné: řádky už se správným zápisem vzor nesplní. Stejný vzor má seed (apps/api/src/seed-pages.ts).

UPDATE "Category" SET
  "seoTitle"       = regexp_replace("seoTitle",       '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])', 'DEJINZERAT.cz', 'g'),
  "seoDescription" = regexp_replace("seoDescription", '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])', 'DEJINZERAT.cz', 'g'),
  "intro"          = regexp_replace("intro",          '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])', 'DEJINZERAT.cz', 'g')
WHERE "seoTitle"       ~ '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])'
   OR "seoDescription" ~ '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])'
   OR "intro"          ~ '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])';

UPDATE "PriceItem" SET
  "name"        = regexp_replace("name",        '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])', 'DEJINZERAT.cz', 'g'),
  "description" = regexp_replace("description", '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])', 'DEJINZERAT.cz', 'g')
WHERE "name"        ~ '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])'
   OR "description" ~ '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])';

-- Nastavení (např. titulek a popis úvodní stránky z administrace)
UPDATE "Setting" SET "value" = regexp_replace("value"::text, '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])', 'DEJINZERAT.cz', 'g')::jsonb
WHERE "value"::text ~ '(?<![A-Za-z0-9_./@-])(?!DEJINZERAT\.cz)(?!dejinzerat\.cz)[Dd][Ee][Jj][Ii][Nn][Zz][Ee][Rr][Aa][Tt]\.[Cc][Zz](?![A-Za-z0-9_])';
