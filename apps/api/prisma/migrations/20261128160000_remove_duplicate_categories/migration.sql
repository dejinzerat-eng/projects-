-- Úklid po přejmenování adres kategorií (20261128120000_category_slugs_from_names).
-- Náhledové sestavení starší větve spustilo starý seed nad produkční databází a ten znovu založil
-- kategorie a podkategorie se starými adresami (např. „mobily“ vedle „mobily-a-prislusenstvi“).
-- Tady se kopie se starou adresou sloučí do kategorie se stejným názvem a novou adresou:
-- případné inzeráty se přesunou, prázdné kopie se smažou. Spustit opakovaně je bezpečné.

CREATE TEMP TABLE _dup_parent_map (old text, new text);
INSERT INTO _dup_parent_map VALUES
  ('mobily', 'mobily-a-prislusenstvi'),
  ('pocitace', 'pocitace-a-it'),
  ('nabytek', 'nabytek-a-bydleni'),
  ('dum-zahrada', 'dum-a-zahrada'),
  ('obleceni', 'obleceni-a-obuv'),
  ('deti', 'deti-a-kojenecke-potreby'),
  ('sport', 'sport-a-volny-cas'),
  ('zvirata', 'zvirata-a-chovatelske-potreby'),
  ('prace', 'prace-a-brigady'),
  ('sluzby', 'sluzby-a-remesla'),
  ('stroje-naradi', 'stroje-a-naradi'),
  ('hudba', 'hudba-a-hudebni-nastroje'),
  ('sberatelstvi', 'sberatelstvi-a-starozitnosti'),
  ('knihy', 'knihy-a-ucebnice'),
  ('hobby', 'hobby-a-volny-cas'),
  ('potraviny', 'potraviny-a-zemedelstvi');

CREATE TEMP TABLE _dup_sub_map (old text, new text);
INSERT INTO _dup_sub_map VALUES
  ('osobni-auta', 'osobni-automobily'),
  ('motorky', 'motocykly-a-skutry'),
  ('uzitkova-vozidla', 'uzitkove-vozy'),
  ('pneu-kola', 'pneumatiky-a-kola'),
  ('karavany', 'karavany-a-privesy'),
  ('auto-prislusenstvi', 'prislusenstvi'),
  ('byty', 'byty-na-prodej'),
  ('byty-pronajem', 'byty-k-pronajmu'),
  ('chaty-chalupy', 'chaty-a-chalupy'),
  ('komercni', 'komercni-prostory'),
  ('audio', 'audio-technika'),
  ('foto-video', 'fotoaparaty-a-video'),
  ('stolni-pc', 'stolni-pocitace'),
  ('periferie', 'periferie-a-prislusenstvi'),
  ('site-servery', 'site-a-servery'),
  ('kuchyne', 'kuchyne-a-jidelna'),
  ('dekorace', 'dekorace-a-doplnky'),
  ('rostliny', 'rostliny-a-semena'),
  ('vytapeni', 'vytapeni-a-klimatizace'),
  ('bazeny', 'bazeny-a-virivky'),
  ('damske', 'damske-obleceni'),
  ('panske', 'panske-obleceni'),
  ('doplnky', 'doplnky-a-sperky'),
  ('kabelky', 'kabelky-a-tasky'),
  ('fitness', 'fitness-a-posilovani'),
  ('turistika', 'turistika-a-kempovani'),
  ('akvaristika', 'akvaristika-a-teraristika'),
  ('remesla', 'remesla-a-opravy'),
  ('stehovani', 'stehovani-a-doprava'),
  ('douceni', 'doucovani-a-kurzy'),
  ('krasa', 'krasa-a-zdravi'),
  ('it-sluzby', 'it-a-web'),
  ('dilna', 'dilenske-vybaveni'),
  ('kytary', 'kytary-a-baskytary'),
  ('klavesy', 'klavesy-a-piana'),
  ('bici', 'bici-nastroje'),
  ('dechove', 'dechove-nastroje'),
  ('studio', 'studio-a-ozvuceni'),
  ('desky', 'desky-cd-a-noty'),
  ('mince', 'mince-a-bankovky'),
  ('umeni', 'obrazy-a-umeni'),
  ('modely', 'modely-a-figurky'),
  ('stare-knihy', 'stare-knihy-a-komiksy'),
  ('ucebnice', 'ucebnice-a-skripta'),
  ('odborna', 'odborna-literatura'),
  ('komiksy', 'komiksy-a-manga'),
  ('deskovky', 'deskove-a-karetni-hry'),
  ('rucni-prace', 'rucni-prace-a-vytvarne-potreby'),
  ('vstupenky-zazitky', 'zazitky-a-cestovani'),
  ('farmarske', 'farmarske-potraviny'),
  ('ovoce-zelenina', 'ovoce-a-zelenina'),
  ('med', 'med-a-vceli-produkty'),
  ('osiva-sazenice', 'osiva-sazenice-a-krmiva'),
  ('vstupenky', 'vstupenky-a-poukazy'),
  ('darujeme', 'daruji-zdarma');

-- Dvojice hlavních kategorií: kopie se starou adresou → kategorie se stejným názvem a novou adresou
CREATE TEMP TABLE _dup_parents AS
SELECT d.id AS dup, k.id AS keep
FROM "Category" d
JOIN _dup_parent_map m ON d.slug = m.old
JOIN "Category" k ON k.slug = m.new AND k."parentId" IS NULL AND k.name = d.name AND k.id <> d.id
WHERE d."parentId" IS NULL;

-- 1) Inzeráty v podkategoriích kopie → stejnojmenná podkategorie původní kategorie
UPDATE "Listing" l SET "categoryId" = kc.id
FROM _dup_parents p, "Category" dc, "Category" kc
WHERE dc."parentId" = p.dup AND kc."parentId" = p.keep AND kc.name = dc.name AND l."categoryId" = dc.id;

-- Inzeráty přímo v kopii hlavní kategorie (běžně nejsou) → původní hlavní kategorie
UPDATE "Listing" l SET "categoryId" = p.keep FROM _dup_parents p WHERE l."categoryId" = p.dup;

-- Podkategorie kopie, která v původní kategorii nemá protějšek, se přesune pod původní kategorii
UPDATE "Category" dc SET "parentId" = p.keep
FROM _dup_parents p
WHERE dc."parentId" = p.dup
  AND NOT EXISTS (SELECT 1 FROM "Category" kc WHERE kc."parentId" = p.keep AND (kc.name = dc.name OR kc.slug = dc.slug));

-- Prázdné kopie smazat (podkategorie, pak hlavní kategorie)
DELETE FROM "Category" dc USING _dup_parents p
WHERE dc."parentId" = p.dup AND NOT EXISTS (SELECT 1 FROM "Listing" l WHERE l."categoryId" = dc.id);
DELETE FROM "Category" d USING _dup_parents p
WHERE d.id = p.dup
  AND NOT EXISTS (SELECT 1 FROM "Listing" l WHERE l."categoryId" = d.id)
  AND NOT EXISTS (SELECT 1 FROM "Category" c WHERE c."parentId" = d.id);

-- 2) Kopie podkategorií pod stejnou hlavní kategorií (např. auto-moto/osobni-auta vedle osobni-automobily)
CREATE TEMP TABLE _dup_subs AS
SELECT d.id AS dup, k.id AS keep
FROM "Category" d
JOIN _dup_sub_map m ON d.slug = m.old
JOIN "Category" k ON k."parentId" = d."parentId" AND k.slug = m.new AND k.name = d.name AND k.id <> d.id
WHERE d."parentId" IS NOT NULL;

UPDATE "Listing" l SET "categoryId" = s.keep FROM _dup_subs s WHERE l."categoryId" = s.dup;
DELETE FROM "Category" d USING _dup_subs s
WHERE d.id = s.dup AND NOT EXISTS (SELECT 1 FROM "Listing" l WHERE l."categoryId" = d.id);

-- Úvodní texty a SEO údaje se ze smazaných kopií nepřenáší: kopie je měly jen výchozí ze seedu.

-- Uložená hledání (hlídací pes) – parametry category / sub
UPDATE "SavedSearch" s SET "query" = jsonb_set(s."query"::jsonb, '{sub}', to_jsonb(m.new::text))
FROM (VALUES
  ('auto-moto', 'osobni-auta', 'osobni-automobily'),
  ('auto-moto', 'motorky', 'motocykly-a-skutry'),
  ('auto-moto', 'uzitkova-vozidla', 'uzitkove-vozy'),
  ('auto-moto', 'pneu-kola', 'pneumatiky-a-kola'),
  ('auto-moto', 'karavany', 'karavany-a-privesy'),
  ('auto-moto', 'auto-prislusenstvi', 'prislusenstvi'),
  ('reality', 'byty', 'byty-na-prodej'),
  ('reality', 'byty-pronajem', 'byty-k-pronajmu'),
  ('reality', 'chaty-chalupy', 'chaty-a-chalupy'),
  ('reality', 'komercni', 'komercni-prostory'),
  ('elektronika', 'audio', 'audio-technika'),
  ('elektronika', 'foto-video', 'fotoaparaty-a-video'),
  ('pocitace', 'stolni-pc', 'stolni-pocitace'),
  ('pocitace', 'periferie', 'periferie-a-prislusenstvi'),
  ('pocitace', 'site-servery', 'site-a-servery'),
  ('nabytek', 'kuchyne', 'kuchyne-a-jidelna'),
  ('nabytek', 'dekorace', 'dekorace-a-doplnky'),
  ('dum-zahrada', 'rostliny', 'rostliny-a-semena'),
  ('dum-zahrada', 'vytapeni', 'vytapeni-a-klimatizace'),
  ('dum-zahrada', 'bazeny', 'bazeny-a-virivky'),
  ('obleceni', 'damske', 'damske-obleceni'),
  ('obleceni', 'panske', 'panske-obleceni'),
  ('obleceni', 'doplnky', 'doplnky-a-sperky'),
  ('obleceni', 'kabelky', 'kabelky-a-tasky'),
  ('sport', 'fitness', 'fitness-a-posilovani'),
  ('sport', 'turistika', 'turistika-a-kempovani'),
  ('zvirata', 'akvaristika', 'akvaristika-a-teraristika'),
  ('sluzby', 'remesla', 'remesla-a-opravy'),
  ('sluzby', 'stehovani', 'stehovani-a-doprava'),
  ('sluzby', 'douceni', 'doucovani-a-kurzy'),
  ('sluzby', 'krasa', 'krasa-a-zdravi'),
  ('sluzby', 'it-sluzby', 'it-a-web'),
  ('stroje-naradi', 'dilna', 'dilenske-vybaveni'),
  ('hudba', 'kytary', 'kytary-a-baskytary'),
  ('hudba', 'klavesy', 'klavesy-a-piana'),
  ('hudba', 'bici', 'bici-nastroje'),
  ('hudba', 'dechove', 'dechove-nastroje'),
  ('hudba', 'studio', 'studio-a-ozvuceni'),
  ('hudba', 'desky', 'desky-cd-a-noty'),
  ('sberatelstvi', 'mince', 'mince-a-bankovky'),
  ('sberatelstvi', 'umeni', 'obrazy-a-umeni'),
  ('sberatelstvi', 'modely', 'modely-a-figurky'),
  ('sberatelstvi', 'stare-knihy', 'stare-knihy-a-komiksy'),
  ('knihy', 'ucebnice', 'ucebnice-a-skripta'),
  ('knihy', 'odborna', 'odborna-literatura'),
  ('knihy', 'komiksy', 'komiksy-a-manga'),
  ('hobby', 'deskovky', 'deskove-a-karetni-hry'),
  ('hobby', 'rucni-prace', 'rucni-prace-a-vytvarne-potreby'),
  ('hobby', 'vstupenky-zazitky', 'zazitky-a-cestovani'),
  ('potraviny', 'farmarske', 'farmarske-potraviny'),
  ('potraviny', 'ovoce-zelenina', 'ovoce-a-zelenina'),
  ('potraviny', 'med', 'med-a-vceli-produkty'),
  ('potraviny', 'osiva-sazenice', 'osiva-sazenice-a-krmiva'),
  ('ostatni', 'vstupenky', 'vstupenky-a-poukazy'),
  ('ostatni', 'darujeme', 'daruji-zdarma')
) AS m(parent_old, old, new)
WHERE s."query"::jsonb ->> 'category' = m.parent_old AND s."query"::jsonb ->> 'sub' = m.old;

UPDATE "SavedSearch" s SET "query" = jsonb_set(s."query"::jsonb, '{category}', to_jsonb(m.new::text))
FROM (VALUES
  ('mobily', 'mobily-a-prislusenstvi'),
  ('pocitace', 'pocitace-a-it'),
  ('nabytek', 'nabytek-a-bydleni'),
  ('dum-zahrada', 'dum-a-zahrada'),
  ('obleceni', 'obleceni-a-obuv'),
  ('deti', 'deti-a-kojenecke-potreby'),
  ('sport', 'sport-a-volny-cas'),
  ('zvirata', 'zvirata-a-chovatelske-potreby'),
  ('prace', 'prace-a-brigady'),
  ('sluzby', 'sluzby-a-remesla'),
  ('stroje-naradi', 'stroje-a-naradi'),
  ('hudba', 'hudba-a-hudebni-nastroje'),
  ('sberatelstvi', 'sberatelstvi-a-starozitnosti'),
  ('knihy', 'knihy-a-ucebnice'),
  ('hobby', 'hobby-a-volny-cas'),
  ('potraviny', 'potraviny-a-zemedelstvi')
) AS m(old, new)
WHERE s."query"::jsonb ->> 'category' = m.old;

-- Existující přesměrování (např. ze starého webu), která vedou na výpis kategorie, míří rovnou na novou adresu
UPDATE "Redirect" r SET "to" = m.new || substr(r."to", length(m.old) + 1)
FROM (VALUES
  ('/kategorie/auto-moto/osobni-auta', '/kategorie/auto-moto/osobni-automobily'),
  ('/kategorie/auto-moto/motorky', '/kategorie/auto-moto/motocykly-a-skutry'),
  ('/kategorie/auto-moto/uzitkova-vozidla', '/kategorie/auto-moto/uzitkove-vozy'),
  ('/kategorie/auto-moto/pneu-kola', '/kategorie/auto-moto/pneumatiky-a-kola'),
  ('/kategorie/auto-moto/karavany', '/kategorie/auto-moto/karavany-a-privesy'),
  ('/kategorie/auto-moto/auto-prislusenstvi', '/kategorie/auto-moto/prislusenstvi'),
  ('/kategorie/reality/byty', '/kategorie/reality/byty-na-prodej'),
  ('/kategorie/reality/byty-pronajem', '/kategorie/reality/byty-k-pronajmu'),
  ('/kategorie/reality/chaty-chalupy', '/kategorie/reality/chaty-a-chalupy'),
  ('/kategorie/reality/komercni', '/kategorie/reality/komercni-prostory'),
  ('/kategorie/elektronika/audio', '/kategorie/elektronika/audio-technika'),
  ('/kategorie/elektronika/foto-video', '/kategorie/elektronika/fotoaparaty-a-video'),
  ('/kategorie/mobily/mobilni-telefony', '/kategorie/mobily-a-prislusenstvi/mobilni-telefony'),
  ('/kategorie/mobily/chytre-hodinky', '/kategorie/mobily-a-prislusenstvi/chytre-hodinky'),
  ('/kategorie/mobily/tablety', '/kategorie/mobily-a-prislusenstvi/tablety'),
  ('/kategorie/mobily/prislusenstvi', '/kategorie/mobily-a-prislusenstvi/prislusenstvi'),
  ('/kategorie/pocitace/notebooky', '/kategorie/pocitace-a-it/notebooky'),
  ('/kategorie/pocitace/stolni-pc', '/kategorie/pocitace-a-it/stolni-pocitace'),
  ('/kategorie/pocitace/komponenty', '/kategorie/pocitace-a-it/komponenty'),
  ('/kategorie/pocitace/monitory', '/kategorie/pocitace-a-it/monitory'),
  ('/kategorie/pocitace/periferie', '/kategorie/pocitace-a-it/periferie-a-prislusenstvi'),
  ('/kategorie/pocitace/site-servery', '/kategorie/pocitace-a-it/site-a-servery'),
  ('/kategorie/nabytek/obyvaci-pokoj', '/kategorie/nabytek-a-bydleni/obyvaci-pokoj'),
  ('/kategorie/nabytek/loznice', '/kategorie/nabytek-a-bydleni/loznice'),
  ('/kategorie/nabytek/kuchyne', '/kategorie/nabytek-a-bydleni/kuchyne-a-jidelna'),
  ('/kategorie/nabytek/koupelna', '/kategorie/nabytek-a-bydleni/koupelna'),
  ('/kategorie/nabytek/dekorace', '/kategorie/nabytek-a-bydleni/dekorace-a-doplnky'),
  ('/kategorie/nabytek/osvetleni', '/kategorie/nabytek-a-bydleni/osvetleni'),
  ('/kategorie/dum-zahrada/zahradni-technika', '/kategorie/dum-a-zahrada/zahradni-technika'),
  ('/kategorie/dum-zahrada/zahradni-nabytek', '/kategorie/dum-a-zahrada/zahradni-nabytek'),
  ('/kategorie/dum-zahrada/rostliny', '/kategorie/dum-a-zahrada/rostliny-a-semena'),
  ('/kategorie/dum-zahrada/stavebniny', '/kategorie/dum-a-zahrada/stavebniny'),
  ('/kategorie/dum-zahrada/vytapeni', '/kategorie/dum-a-zahrada/vytapeni-a-klimatizace'),
  ('/kategorie/dum-zahrada/bazeny', '/kategorie/dum-a-zahrada/bazeny-a-virivky'),
  ('/kategorie/obleceni/damske', '/kategorie/obleceni-a-obuv/damske-obleceni'),
  ('/kategorie/obleceni/panske', '/kategorie/obleceni-a-obuv/panske-obleceni'),
  ('/kategorie/obleceni/obuv', '/kategorie/obleceni-a-obuv/obuv'),
  ('/kategorie/obleceni/doplnky', '/kategorie/obleceni-a-obuv/doplnky-a-sperky'),
  ('/kategorie/obleceni/kabelky', '/kategorie/obleceni-a-obuv/kabelky-a-tasky'),
  ('/kategorie/deti/kocarky', '/kategorie/deti-a-kojenecke-potreby/kocarky'),
  ('/kategorie/deti/autosedacky', '/kategorie/deti-a-kojenecke-potreby/autosedacky'),
  ('/kategorie/deti/detske-obleceni', '/kategorie/deti-a-kojenecke-potreby/detske-obleceni'),
  ('/kategorie/deti/hracky', '/kategorie/deti-a-kojenecke-potreby/hracky'),
  ('/kategorie/deti/detsky-nabytek', '/kategorie/deti-a-kojenecke-potreby/detsky-nabytek'),
  ('/kategorie/sport/cyklistika', '/kategorie/sport-a-volny-cas/cyklistika'),
  ('/kategorie/sport/zimni-sporty', '/kategorie/sport-a-volny-cas/zimni-sporty'),
  ('/kategorie/sport/fitness', '/kategorie/sport-a-volny-cas/fitness-a-posilovani'),
  ('/kategorie/sport/turistika', '/kategorie/sport-a-volny-cas/turistika-a-kempovani'),
  ('/kategorie/sport/vodni-sporty', '/kategorie/sport-a-volny-cas/vodni-sporty'),
  ('/kategorie/sport/micove-sporty', '/kategorie/sport-a-volny-cas/micove-sporty'),
  ('/kategorie/zvirata/psi', '/kategorie/zvirata-a-chovatelske-potreby/psi'),
  ('/kategorie/zvirata/kocky', '/kategorie/zvirata-a-chovatelske-potreby/kocky'),
  ('/kategorie/zvirata/hlodavci', '/kategorie/zvirata-a-chovatelske-potreby/hlodavci'),
  ('/kategorie/zvirata/ptaci', '/kategorie/zvirata-a-chovatelske-potreby/ptaci'),
  ('/kategorie/zvirata/akvaristika', '/kategorie/zvirata-a-chovatelske-potreby/akvaristika-a-teraristika'),
  ('/kategorie/zvirata/chovatelske-potreby', '/kategorie/zvirata-a-chovatelske-potreby/chovatelske-potreby'),
  ('/kategorie/prace/nabidka-prace', '/kategorie/prace-a-brigady/nabidka-prace'),
  ('/kategorie/prace/brigady', '/kategorie/prace-a-brigady/brigady'),
  ('/kategorie/prace/hledam-praci', '/kategorie/prace-a-brigady/hledam-praci'),
  ('/kategorie/sluzby/remesla', '/kategorie/sluzby-a-remesla/remesla-a-opravy'),
  ('/kategorie/sluzby/stehovani', '/kategorie/sluzby-a-remesla/stehovani-a-doprava'),
  ('/kategorie/sluzby/uklid', '/kategorie/sluzby-a-remesla/uklid'),
  ('/kategorie/sluzby/douceni', '/kategorie/sluzby-a-remesla/doucovani-a-kurzy'),
  ('/kategorie/sluzby/krasa', '/kategorie/sluzby-a-remesla/krasa-a-zdravi'),
  ('/kategorie/sluzby/it-sluzby', '/kategorie/sluzby-a-remesla/it-a-web'),
  ('/kategorie/stroje-naradi/elektricke-naradi', '/kategorie/stroje-a-naradi/elektricke-naradi'),
  ('/kategorie/stroje-naradi/rucni-naradi', '/kategorie/stroje-a-naradi/rucni-naradi'),
  ('/kategorie/stroje-naradi/stavebni-stroje', '/kategorie/stroje-a-naradi/stavebni-stroje'),
  ('/kategorie/stroje-naradi/zemedelske-stroje', '/kategorie/stroje-a-naradi/zemedelske-stroje'),
  ('/kategorie/stroje-naradi/dilna', '/kategorie/stroje-a-naradi/dilenske-vybaveni'),
  ('/kategorie/hudba/kytary', '/kategorie/hudba-a-hudebni-nastroje/kytary-a-baskytary'),
  ('/kategorie/hudba/klavesy', '/kategorie/hudba-a-hudebni-nastroje/klavesy-a-piana'),
  ('/kategorie/hudba/bici', '/kategorie/hudba-a-hudebni-nastroje/bici-nastroje'),
  ('/kategorie/hudba/dechove', '/kategorie/hudba-a-hudebni-nastroje/dechove-nastroje'),
  ('/kategorie/hudba/studio', '/kategorie/hudba-a-hudebni-nastroje/studio-a-ozvuceni'),
  ('/kategorie/hudba/desky', '/kategorie/hudba-a-hudebni-nastroje/desky-cd-a-noty'),
  ('/kategorie/sberatelstvi/mince', '/kategorie/sberatelstvi-a-starozitnosti/mince-a-bankovky'),
  ('/kategorie/sberatelstvi/znamky', '/kategorie/sberatelstvi-a-starozitnosti/znamky'),
  ('/kategorie/sberatelstvi/starozitnosti', '/kategorie/sberatelstvi-a-starozitnosti/starozitnosti'),
  ('/kategorie/sberatelstvi/umeni', '/kategorie/sberatelstvi-a-starozitnosti/obrazy-a-umeni'),
  ('/kategorie/sberatelstvi/modely', '/kategorie/sberatelstvi-a-starozitnosti/modely-a-figurky'),
  ('/kategorie/sberatelstvi/stare-knihy', '/kategorie/sberatelstvi-a-starozitnosti/stare-knihy-a-komiksy'),
  ('/kategorie/knihy/beletrie', '/kategorie/knihy-a-ucebnice/beletrie'),
  ('/kategorie/knihy/ucebnice', '/kategorie/knihy-a-ucebnice/ucebnice-a-skripta'),
  ('/kategorie/knihy/odborna', '/kategorie/knihy-a-ucebnice/odborna-literatura'),
  ('/kategorie/knihy/detske-knihy', '/kategorie/knihy-a-ucebnice/detske-knihy'),
  ('/kategorie/knihy/komiksy', '/kategorie/knihy-a-ucebnice/komiksy-a-manga'),
  ('/kategorie/knihy/casopisy', '/kategorie/knihy-a-ucebnice/casopisy'),
  ('/kategorie/hobby/deskovky', '/kategorie/hobby-a-volny-cas/deskove-a-karetni-hry'),
  ('/kategorie/hobby/modelarstvi', '/kategorie/hobby-a-volny-cas/modelarstvi'),
  ('/kategorie/hobby/rucni-prace', '/kategorie/hobby-a-volny-cas/rucni-prace-a-vytvarne-potreby'),
  ('/kategorie/hobby/rybareni', '/kategorie/hobby-a-volny-cas/rybareni'),
  ('/kategorie/hobby/myslivost', '/kategorie/hobby-a-volny-cas/myslivost'),
  ('/kategorie/hobby/vstupenky-zazitky', '/kategorie/hobby-a-volny-cas/zazitky-a-cestovani'),
  ('/kategorie/potraviny/farmarske', '/kategorie/potraviny-a-zemedelstvi/farmarske-potraviny'),
  ('/kategorie/potraviny/ovoce-zelenina', '/kategorie/potraviny-a-zemedelstvi/ovoce-a-zelenina'),
  ('/kategorie/potraviny/med', '/kategorie/potraviny-a-zemedelstvi/med-a-vceli-produkty'),
  ('/kategorie/potraviny/hospodarska-zvirata', '/kategorie/potraviny-a-zemedelstvi/hospodarska-zvirata'),
  ('/kategorie/potraviny/zemedelska-technika', '/kategorie/potraviny-a-zemedelstvi/zemedelska-technika'),
  ('/kategorie/potraviny/osiva-sazenice', '/kategorie/potraviny-a-zemedelstvi/osiva-sazenice-a-krmiva'),
  ('/kategorie/ostatni/vstupenky', '/kategorie/ostatni/vstupenky-a-poukazy'),
  ('/kategorie/ostatni/darujeme', '/kategorie/ostatni/daruji-zdarma')
) AS m(old, new)
WHERE r."to" = m.old OR r."to" LIKE m.old || '/%' OR r."to" LIKE m.old || '?%';

UPDATE "Redirect" r SET "to" = m.new || substr(r."to", length(m.old) + 1)
FROM (VALUES
  ('/kategorie/mobily', '/kategorie/mobily-a-prislusenstvi'),
  ('/kategorie/pocitace', '/kategorie/pocitace-a-it'),
  ('/kategorie/nabytek', '/kategorie/nabytek-a-bydleni'),
  ('/kategorie/dum-zahrada', '/kategorie/dum-a-zahrada'),
  ('/kategorie/obleceni', '/kategorie/obleceni-a-obuv'),
  ('/kategorie/deti', '/kategorie/deti-a-kojenecke-potreby'),
  ('/kategorie/sport', '/kategorie/sport-a-volny-cas'),
  ('/kategorie/zvirata', '/kategorie/zvirata-a-chovatelske-potreby'),
  ('/kategorie/prace', '/kategorie/prace-a-brigady'),
  ('/kategorie/sluzby', '/kategorie/sluzby-a-remesla'),
  ('/kategorie/stroje-naradi', '/kategorie/stroje-a-naradi'),
  ('/kategorie/hudba', '/kategorie/hudba-a-hudebni-nastroje'),
  ('/kategorie/sberatelstvi', '/kategorie/sberatelstvi-a-starozitnosti'),
  ('/kategorie/knihy', '/kategorie/knihy-a-ucebnice'),
  ('/kategorie/hobby', '/kategorie/hobby-a-volny-cas'),
  ('/kategorie/potraviny', '/kategorie/potraviny-a-zemedelstvi')
) AS m(old, new)
WHERE r."to" = m.old OR r."to" LIKE m.old || '/%' OR r."to" LIKE m.old || '?%';

-- Pravidlo, které by teď vedlo samo na sebe, nemá smysl
DELETE FROM "Redirect" WHERE "from" = "to";


-- 3) Pojistka: dvě hlavní kategorie (nebo dvě podkategorie jedné kategorie) se stejným názvem už nevzniknou
--    a hlavní kategorie nemohou mít stejnou adresu (unikátní [parentId, slug] u hlavních nepomáhá, NULL se neporovnává).
--    Starý seed z neaktualizované větve pak místo založení kopie skončí chybou a databázi nezmění.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Category" WHERE "parentId" IS NULL GROUP BY name HAVING COUNT(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Category_root_name_key" ON "Category" (name) WHERE "parentId" IS NULL;
  ELSE
    RAISE NOTICE 'Hlavní kategorie se stejným názvem stále existují – unikátní index názvů se nevytvořil.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Category" WHERE "parentId" IS NULL GROUP BY slug HAVING COUNT(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Category_root_slug_key" ON "Category" (slug) WHERE "parentId" IS NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "Category" WHERE "parentId" IS NOT NULL GROUP BY "parentId", name HAVING COUNT(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Category_parentId_name_key" ON "Category" ("parentId", name) WHERE "parentId" IS NOT NULL;
  ELSE
    RAISE NOTICE 'Podkategorie se stejným názvem stále existují – unikátní index názvů se nevytvořil.';
  END IF;
END $$;

DROP TABLE _dup_parents; DROP TABLE _dup_subs; DROP TABLE _dup_parent_map; DROP TABLE _dup_sub_map;
