-- Úvodní (SEO) texty pro všech 112 podkategorií.
-- Vyplní se jen tam, kde je text prázdný – úpravy z administrace (/admin/seo) se nikdy nepřepíšou.

UPDATE "Category" c SET "intro" = $intro$## Ojeté a nové osobní automobily

Vybírejte z nabídky osobních aut od soukromých prodejců i autobazarů z celé České republiky. Své auto tu prodáte rychle, inzerát přidáte zdarma.

- **Malá městská auta**, hatchbacky a sedany
- **Kombi, SUV a MPV** pro rodinu
- **Elektromobily a hybridy**

Filtrujte podle značky, ceny, roku výroby, najetých kilometrů, paliva, převodovky, karoserie nebo výkonu a najděte auto, které vám sedne.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'auto-moto' AND c.slug = 'osobni-auta' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Motocykly a skútry

Hledáte silniční motorku, enduro nebo skútr do města? Na Dejinzerat.cz najdete nové i ojeté motocykly od prodejců z celé ČR. Svůj stroj prodáte i vy, inzerát přidáte zdarma.

- **Silniční, cestovní a sportovní motorky**
- **Enduro, cross a čtyřkolky**
- **Skútry a mopedy** do města

Filtrujte podle značky, ceny, roku výroby, najetých kilometrů nebo lokality.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'auto-moto' AND c.slug = 'motorky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Užitkové vozy a dodávky

Potřebujete dodávku pro firmu nebo pick-up na stavbu? Na Dejinzerat.cz najdete užitkové vozy od živnostníků, firem i soukromých prodejců z celé ČR. Inzerát přidáte zdarma.

- **Dodávky a skříňové vozy**
- **Pick-upy** a valníky
- **Malé užitkové vozy** pro řemeslníky

Filtrujte podle značky, ceny, roku výroby, najetých kilometrů, paliva nebo karoserie a najděte vůz, který unese vaši práci.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'auto-moto' AND c.slug = 'uzitkova-vozidla' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Náhradní díly na auta a motorky

Sháníte díl na opravu a nechcete platit za nový? Na Dejinzerat.cz najdete použité i nové náhradní díly od prodejců a vrakovišť z celé ČR. Díly, které vám zbyly, prodáte zdarma.

- **Motory, převodovky** a díly podvozku
- **Karosářské díly**, světla a skla
- **Elektroinstalace** a díly interiéru

Filtrujte podle ceny, stavu nebo lokality a ušetřete na opravě svého vozu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'auto-moto' AND c.slug = 'nahradni-dily' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Pneumatiky a kola

Přezouváte na zimu nebo hledáte nová kola? Na Dejinzerat.cz najdete letní, zimní i celoroční pneumatiky a disky od prodejců z celé ČR. Nepotřebné gumy prodáte zdarma.

- **Letní a zimní pneumatiky**
- **Celoroční pneu** pro osobní i užitková auta
- **Alu a plechové disky**, kompletní kola

Filtrujte podle ceny, stavu nebo lokality a vyzvedněte si kola klidně ještě dnes ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'auto-moto' AND c.slug = 'pneu-kola' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Karavany, obytné vozy a přívěsy

Plánujete cestování bez hotelů nebo potřebujete přívěs za auto? Na Dejinzerat.cz najdete karavany, obytné vozy i přívěsné vozíky od prodejců z celé ČR. Inzerát přidáte zdarma.

- **Obytné vozy a vestavby**
- **Karavany** pro rodinné cestování
- **Přívěsné vozíky** a přívěsy na lodě či motorky

Filtrujte podle značky, ceny, roku výroby nebo lokality a vyrazte na cesty.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'auto-moto' AND c.slug = 'karavany' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Autopříslušenství

Vylepšete svůj vůz za rozumnou cenu. Na Dejinzerat.cz najdete příslušenství do auta i na motorku od prodejců z celé ČR. Věci, které už nevyužijete, prodáte zdarma.

- **Střešní boxy, nosiče** a tažná zařízení
- **Autorádia, navigace** a kamery do auta
- **Autokosmetika**, potahy a koberečky

Filtrujte podle ceny, stavu nebo lokality a najděte doplněk pro svůj vůz.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'auto-moto' AND c.slug = 'auto-prislusenstvi' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Byty na prodej

Hledáte vlastní bydlení? Na Dejinzerat.cz najdete byty na prodej od majitelů i realitních kanceláří z celé ČR. Prodáváte byt? Inzerát přidáte zdarma a oslovíte kupce přímo.

- **Garsonky a menší byty** 1+kk a 2+kk
- **Rodinné byty** 3+1 a větší
- **Novostavby** i byty k rekonstrukci

Filtrujte podle ceny, dispozice, užitné plochy, vlastnictví, energetické třídy nebo lokality a najděte nový domov.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'reality' AND c.slug = 'byty' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Byty k pronájmu

Stěhujete se za prací nebo do většího? Na Dejinzerat.cz najdete byty k pronájmu i podnájmu od majitelů a realitních kanceláří z celé ČR. Pronajímáte byt? Inzerát přidáte zdarma.

- **Garsonky a menší byty** pro jednotlivce
- **Rodinné byty** k dlouhodobému pronájmu
- **Podnájmy** a spolubydlení

Filtrujte podle ceny, dispozice, užitné plochy nebo lokality a najděte bydlení, které vám sedne.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'reality' AND c.slug = 'byty-pronajem' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Rodinné domy na prodej i k pronájmu

Sníte o domě se zahradou? Na Dejinzerat.cz najdete rodinné domy a vily od majitelů i realitních kanceláří z celé ČR. Prodáváte nebo pronajímáte dům? Inzerát přidáte zdarma.

- **Rodinné domy** ve městě i na vesnici
- **Řadové domy** a dvojdomy
- **Novostavby** i domy k rekonstrukci

Filtrujte podle ceny, typu nabídky, dispozice, užitné plochy, energetické třídy nebo lokality a najděte dům pro svou rodinu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'reality' AND c.slug = 'domy' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Pozemky

Chystáte stavbu nebo hledáte zahradu? Na Dejinzerat.cz najdete pozemky na prodej i k pronájmu od majitelů a realitních kanceláří z celé ČR. Svůj pozemek nabídnete zdarma.

- **Stavební pozemky** pro rodinné domy
- **Zahrady a sady**
- **Zemědělská půda**, louky a lesy

Filtrujte podle ceny, typu nabídky, plochy nebo lokality a najděte místo pro svůj nový začátek.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'reality' AND c.slug = 'pozemky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Chaty a chalupy

Toužíte po místě na víkendy v přírodě? Na Dejinzerat.cz najdete chaty a chalupy na prodej i k pronájmu od majitelů z celé ČR. Svou rekreační nemovitost nabídnete zdarma.

- **Chaty** u vody i v lese
- **Chalupy** na horách a na venkově
- **Rekreační objekty** k pronájmu

Filtrujte podle ceny, typu nabídky, užitné plochy nebo lokality a najděte své místo pro odpočinek.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'reality' AND c.slug = 'chaty-chalupy' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Komerční prostory

Rozjíždíte podnikání nebo hledáte větší provozovnu? Na Dejinzerat.cz najdete komerční nemovitosti na prodej i k pronájmu z celé ČR. Volné prostory nabídnete zdarma.

- **Kanceláře** a coworkingová místa
- **Obchody, restaurace** a provozovny
- **Sklady a výrobní haly**

Filtrujte podle ceny, typu nabídky, užitné plochy, energetické třídy nebo lokality a najděte prostor pro svůj byznys.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'reality' AND c.slug = 'komercni' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Garáže a parkovací stání

Nevíte, kde parkovat? Na Dejinzerat.cz najdete garáže a parkovací místa na prodej i k pronájmu z celé ČR. Volnou garáž nabídnete zdarma a zájemce vás kontaktuje přímo.

- **Samostatné garáže**
- **Garážová stání** v domech
- **Parkovací místa** venku i v podzemí

Filtrujte podle ceny, typu nabídky nebo lokality a najděte místo pro své auto blízko domova.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'reality' AND c.slug = 'garaze' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Televize

Chcete větší obrazovku nebo chytrou televizi? Na Dejinzerat.cz najdete nové i použité televizory od prodejců z celé ČR. Starou televizi tu prodáte, inzerát přidáte zdarma.

- **Smart TV** s internetem a aplikacemi
- **OLED a QLED** televize
- **Menší televize** do kuchyně či na chatu

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a vyberte televizi do svého obýváku.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'elektronika' AND c.slug = 'televize' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Audio technika

Milujete dobrý zvuk? Na Dejinzerat.cz najdete reproduktory, sluchátka i hi-fi sestavy od prodejců z celé ČR. Techniku, kterou už nepoužíváte, prodáte zdarma.

- **Sluchátka** a bezdrátové reproduktory
- **Soundbary** a domácí kina
- **Hi-fi sestavy**, zesilovače a gramofony

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a najděte zvuk, který vás chytne.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'elektronika' AND c.slug = 'audio' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Fotoaparáty a video

Fotíte jako hobby nebo profesionálně? Na Dejinzerat.cz najdete fotoaparáty, objektivy i kamery od fotografů a prodejců z celé ČR. Svou výbavu prodáte, inzerát přidáte zdarma.

- **Zrcadlovky a bezzrcadlovky**
- **Objektivy**, blesky a stativy
- **Kamery, akční kamery** a drony

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a doplňte svou fotovýbavu výhodně.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'elektronika' AND c.slug = 'foto-video' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Herní konzole a hry

Chcete hrát a neutratit majlant? Na Dejinzerat.cz najdete herní konzole, ovladače i hry od hráčů z celé ČR. Dohrané hry nebo starou konzoli prodáte zdarma.

- **PlayStation, Xbox a Nintendo**
- **Hry** pro konzole i počítače
- **Ovladače**, VR brýle a příslušenství

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a pusťte se do hraní.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'elektronika' AND c.slug = 'herni-konzole' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Domácí spotřebiče

Rozbila se pračka nebo zařizujete kuchyň? Na Dejinzerat.cz najdete nové i použité spotřebiče od prodejců z celé ČR. Spotřebič, který už nepotřebujete, prodáte zdarma.

- **Pračky, sušičky** a myčky
- **Lednice, mrazáky** a sporáky
- **Vysavače**, kávovary a malé spotřebiče

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a ušetřete na vybavení domácnosti.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'elektronika' AND c.slug = 'domaci-spotrebice' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Chytrá domácnost

Chcete mít domov pod kontrolou z mobilu? Na Dejinzerat.cz najdete chytrá zařízení do domácnosti od prodejců z celé ČR. Inzerát přidáte zdarma za pár minut.

- **Chytré žárovky**, zásuvky a vypínače
- **Kamery, zvonky** a zabezpečení
- **Robotické vysavače** a chytré reproduktory

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a udělejte svůj domov chytřejší.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'elektronika' AND c.slug = 'chytra-domacnost' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Mobilní telefony

Hledáte nový nebo zánovní telefon? Na Dejinzerat.cz najdete mobily všech značek od prodejců z celé ČR. Starý telefon tu prodáte, inzerát přidáte zdarma.

- **iPhone** a další telefony Apple
- **Android telefony** Samsung, Xiaomi, Google a dalších
- **Tlačítkové telefony** pro seniory

Filtrujte podle značky, ceny, úložiště, kondice baterie, záruky nebo lokality a vyberte telefon bez přeplácení.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'mobily' AND c.slug = 'mobilni-telefony' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Chytré hodinky

Sledujete kroky, tep nebo zprávy na zápěstí? Na Dejinzerat.cz najdete chytré hodinky a náramky od prodejců z celé ČR. Hodinky, které už nenosíte, prodáte zdarma.

- **Apple Watch** a hodinky pro Android
- **Sportovní hodinky** s GPS
- **Fitness náramky**

Filtrujte podle značky, ceny, stavu, kondice baterie, záruky nebo lokality a najděte hodinky pro svůj styl.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'mobily' AND c.slug = 'chytre-hodinky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Tablety

Potřebujete tablet na čtení, filmy nebo do školy? Na Dejinzerat.cz najdete nové i použité tablety od prodejců z celé ČR. Svůj tablet prodáte, inzerát přidáte zdarma.

- **iPad** a tablety Apple
- **Tablety s Androidem**
- **Čtečky e-knih** a dětské tablety

Filtrujte podle značky, ceny, úložiště, kondice baterie, záruky nebo lokality a vyberte si ten pravý.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'mobily' AND c.slug = 'tablety' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Příslušenství k mobilům

Chraňte a nabíjejte svůj telefon výhodně. Na Dejinzerat.cz najdete příslušenství k mobilům a tabletům od prodejců z celé ČR. Nepoužívané doplňky prodáte zdarma.

- **Kryty, pouzdra** a ochranná skla
- **Nabíječky, kabely** a powerbanky
- **Bezdrátová sluchátka** a držáky do auta

Filtrujte podle ceny, stavu nebo lokality a najděte doplněk ke svému telefonu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'mobily' AND c.slug = 'prislusenstvi' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Notebooky

Potřebujete notebook do práce, do školy nebo na hraní? Na Dejinzerat.cz najdete nové i použité notebooky od prodejců z celé ČR. Starý notebook tu prodáte, inzerát přidáte zdarma.

- **MacBooky** a notebooky Apple
- **Pracovní notebooky** Lenovo, Dell, HP a dalších
- **Herní notebooky** s výkonnou grafikou

Filtrujte podle značky, ceny, operační paměti, stavu, záruky nebo lokality a vyberte notebook podle svých potřeb.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'pocitace' AND c.slug = 'notebooky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Stolní počítače

Hledáte výkonné PC na hry, střih videa nebo jen do kanceláře? Na Dejinzerat.cz najdete sestavy i značkové počítače od prodejců z celé ČR. Inzerát přidáte zdarma.

- **Herní sestavy** s výkonnou grafikou
- **Kancelářské počítače** a mini PC
- **Pracovní stanice** a iMacy

Filtrujte podle značky, ceny, operační paměti, stavu, záruky nebo lokality a najděte počítač, který stačí na vaši práci.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'pocitace' AND c.slug = 'stolni-pc' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Počítačové komponenty

Upgradujete nebo stavíte nový počítač? Na Dejinzerat.cz najdete nové i použité komponenty od prodejců z celé ČR. Díly, které vám po upgradu zbyly, prodáte zdarma.

- **Grafické karty** a procesory
- **Operační paměti**, SSD a pevné disky
- **Základní desky**, zdroje a skříně

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a postavte si počítač výhodně.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'pocitace' AND c.slug = 'komponenty' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Monitory

Chcete větší nebo rychlejší obrazovku? Na Dejinzerat.cz najdete monitory pro práci i hraní od prodejců z celé ČR. Starý monitor prodáte, inzerát přidáte zdarma.

- **Kancelářské monitory** Full HD i 4K
- **Herní monitory** s vysokou obnovovací frekvencí
- **Zakřivené a ultraširoké** monitory

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a vyberte monitor na svůj stůl.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'pocitace' AND c.slug = 'monitory' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Periferie a příslušenství

Doplňte svůj počítač o vše potřebné. Na Dejinzerat.cz najdete klávesnice, myši, tiskárny i další příslušenství od prodejců z celé ČR. Nepoužívané věci prodáte zdarma.

- **Klávesnice, myši** a herní příslušenství
- **Tiskárny, skenery** a náplně
- **Webkamery**, reproduktory a dokovací stanice

Filtrujte podle značky, ceny, stavu, záruky nebo lokality a dovybavte svůj pracovní stůl.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'pocitace' AND c.slug = 'periferie' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Sítě a servery

Zlepšujete Wi-Fi doma nebo budujete firemní síť? Na Dejinzerat.cz najdete síťové prvky a servery od prodejců z celé ČR. Inzerát přidáte zdarma.

- **Routery** a Wi-Fi mesh systémy
- **Switche**, access pointy a kabeláž
- **Servery** a datová úložiště NAS

Filtrujte podle značky, ceny, operační paměti, stavu nebo lokality a najděte techniku pro spolehlivou síť.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'pocitace' AND c.slug = 'site-servery' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Nábytek do obývacího pokoje

Chcete pohodlnou sedačku nebo nový stolek? Na Dejinzerat.cz najdete nábytek do obýváku od prodejců z celé ČR. Starý nábytek prodáte nebo darujete, inzerát přidáte zdarma.

- **Sedačky, gauče** a křesla
- **Konferenční stolky** a TV stolky
- **Obývací stěny**, knihovny a police

Filtrujte podle ceny, materiálu, stavu, možnosti dovozu nebo lokality a zařiďte obývák podle sebe.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'nabytek' AND c.slug = 'obyvaci-pokoj' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Nábytek do ložnice

Dobrý spánek začíná u kvalitní postele. Na Dejinzerat.cz najdete nábytek do ložnice od prodejců z celé ČR. Nepotřebnou postel nebo skříň prodáte zdarma.

- **Postele** a rošty
- **Matrace** všech rozměrů
- **Šatní skříně**, komody a noční stolky

Filtrujte podle ceny, materiálu, stavu, možnosti dovozu nebo lokality a vytvořte si ložnici pro klidné noci.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'nabytek' AND c.slug = 'loznice' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Kuchyně a jídelna

Zařizujete kuchyň nebo hledáte jídelní stůl? Na Dejinzerat.cz najdete kuchyňský nábytek i vybavení jídelny od prodejců z celé ČR. Inzerát přidáte zdarma.

- **Kuchyňské linky** a skříňky
- **Jídelní stoly** a židle
- **Barové židle**, vitríny a kuchyňské doplňky

Filtrujte podle ceny, materiálu, stavu, možnosti dovozu nebo lokality a najděte kuchyň, kde budete rádi vařit.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'nabytek' AND c.slug = 'kuchyne' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Koupelna

Rekonstruujete koupelnu? Na Dejinzerat.cz najdete koupelnový nábytek i vybavení od prodejců z celé ČR. Co vám po rekonstrukci zbylo, prodáte zdarma.

- **Koupelnové skříňky** a umyvadla
- **Vany, sprchové kouty** a baterie
- **Zrcadla**, police a doplňky

Filtrujte podle ceny, materiálu, stavu, možnosti dovozu nebo lokality a ušetřete na nové koupelně.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'nabytek' AND c.slug = 'koupelna' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Dekorace a bytové doplňky

Dodejte domovu osobitý styl. Na Dejinzerat.cz najdete dekorace a doplňky do bytu od prodejců z celé ČR. Věci, které se vám už nehodí, prodáte zdarma.

- **Obrazy, zrcadla** a hodiny
- **Koberce**, závěsy a polštáře
- **Vázy, svícny** a sezónní dekorace

Filtrujte podle ceny, materiálu, stavu nebo lokality a najděte detail, který váš domov promění.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'nabytek' AND c.slug = 'dekorace' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Osvětlení

Správné světlo promění každou místnost. Na Dejinzerat.cz najdete svítidla do bytu i na zahradu od prodejců z celé ČR. Nepotřebná světla prodáte zdarma.

- **Lustry** a stropní svítidla
- **Stolní a stojací lampy**
- **Nástěnná, LED a venkovní** osvětlení

Filtrujte podle ceny, materiálu, stavu nebo lokality a vyberte světlo, které se k vám hodí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'nabytek' AND c.slug = 'osvetleni' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Zahradní technika

Ulehčete si práci na zahradě. Na Dejinzerat.cz najdete novou i použitou zahradní techniku od prodejců z celé ČR. Stroj, který už nepotřebujete, prodáte zdarma.

- **Sekačky** a zahradní traktůrky
- **Křovinořezy**, plotostřihy a pily
- **Vysavače listí**, drtiče a čerpadla

Filtrujte podle ceny, stavu, možnosti dovozu nebo lokality a najděte techniku ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'dum-zahrada' AND c.slug = 'zahradni-technika' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Zahradní nábytek

Užijte si léto na terase. Na Dejinzerat.cz najdete zahradní nábytek od prodejců z celé ČR. Starý set prodáte nebo darujete, inzerát přidáte zdarma.

- **Zahradní sety**, stoly a židle
- **Lehátka**, houpačky a houpací sítě
- **Slunečníky**, altány a pergoly

Filtrujte podle ceny, stavu, možnosti dovozu nebo lokality a připravte zahradu na pohodové chvíle.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'dum-zahrada' AND c.slug = 'zahradni-nabytek' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Rostliny a semena

Pěstujete na zahradě, na balkoně nebo doma? Na Dejinzerat.cz najdete rostliny, sazenice i semena od pěstitelů z celé ČR. Přebytky ze zahrady nabídnete zdarma.

- **Pokojové rostliny**
- **Ovocné stromky**, keře a okrasné dřeviny
- **Semena**, sazenice a cibuloviny

Filtrujte podle ceny, možnosti dovozu nebo lokality a vyzvedněte si rostliny u pěstitele ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'dum-zahrada' AND c.slug = 'rostliny' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Stavebniny

Stavíte nebo rekonstruujete? Na Dejinzerat.cz najdete stavební materiál od prodejců i z přebytků staveb z celé ČR. Co vám zbylo, prodáte zdarma a nemusíte to vyhazovat.

- **Cihly, tvárnice** a stavební hmoty
- **Dřevo**, střešní krytina a izolace
- **Okna, dveře** a dlažba

Filtrujte podle ceny, stavu, možnosti dovozu nebo lokality a ušetřete na své stavbě.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'dum-zahrada' AND c.slug = 'stavebniny' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Vytápění a klimatizace

Chcete teplo v zimě a příjemný chlad v létě? Na Dejinzerat.cz najdete topení i klimatizace od prodejců z celé ČR. Inzerát přidáte zdarma za pár minut.

- **Kamna, krby** a kotle
- **Tepelná čerpadla** a radiátory
- **Klimatizace** a ventilátory

Filtrujte podle ceny, stavu, možnosti dovozu nebo lokality a najděte řešení pro příjemný domov.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'dum-zahrada' AND c.slug = 'vytapeni' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Bazény a vířivky

Těšíte se na koupání na vlastní zahradě? Na Dejinzerat.cz najdete bazény, vířivky i příslušenství od prodejců z celé ČR. Inzerát přidáte zdarma.

- **Nadzemní a zapuštěné bazény**
- **Vířivky** a sauny
- **Filtrace**, ohřev a bazénová chemie

Filtrujte podle ceny, stavu, možnosti dovozu nebo lokality a připravte se na léto.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'dum-zahrada' AND c.slug = 'bazeny' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Dámské oblečení

Obnovte šatník bez velkých výdajů. Na Dejinzerat.cz najdete nové i nošené dámské oblečení od prodejců z celé ČR. Věci, které už nenosíte, prodáte zdarma.

- **Šaty, sukně** a halenky
- **Kalhoty, džíny** a svetry
- **Bundy a kabáty**

Filtrujte podle velikosti, značky, ceny, stavu nebo lokality a najděte kousek, který vám padne.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'obleceni' AND c.slug = 'damske' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Pánské oblečení

Hledáte značkové oblečení za rozumnou cenu? Na Dejinzerat.cz najdete pánské oblečení od prodejců z celé ČR. Co ve skříni jen visí, prodáte zdarma.

- **Trička, košile** a mikiny
- **Kalhoty a džíny**
- **Bundy, kabáty** a obleky

Filtrujte podle velikosti, značky, ceny, stavu nebo lokality a obléknete se dobře i levně.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'obleceni' AND c.slug = 'panske' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Obuv

Boty pro každou příležitost za rozumnou cenu. Na Dejinzerat.cz najdete dámskou i pánskou obuv od prodejců z celé ČR. Boty, které vám nesedí, prodáte zdarma.

- **Tenisky** a sportovní obuv
- **Kozačky** a zimní boty
- **Společenská obuv** a sandály

Filtrujte podle velikosti bot, značky, ceny, stavu nebo lokality a najděte pohodlné boty.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'obleceni' AND c.slug = 'obuv' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Doplňky a šperky

Malé detaily dělají velký rozdíl. Na Dejinzerat.cz najdete módní doplňky a šperky od prodejců z celé ČR. Nepoužívané doplňky prodáte zdarma.

- **Šperky**, prsteny a náhrdelníky
- **Hodinky** a sluneční brýle
- **Pásky, šátky** a čepice

Filtrujte podle značky, ceny, stavu nebo lokality a doplňte svůj styl.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'obleceni' AND c.slug = 'doplnky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Kabelky a tašky

Hledáte kabelku do města nebo batoh na cesty? Na Dejinzerat.cz najdete kabelky a tašky od prodejců z celé ČR. Kabelku, kterou už nenosíte, prodáte zdarma.

- **Kabelky** a psaníčka
- **Batohy** a městské tašky
- **Cestovní tašky** a kufry

Filtrujte podle značky, ceny, stavu nebo lokality a najděte tašku pro každou příležitost.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'obleceni' AND c.slug = 'kabelky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Kočárky

Kočárek se dá výhodně koupit i po jiném dítěti. Na Dejinzerat.cz najdete kočárky od rodičů z celé ČR. Kočárek, který už nepotřebujete, prodáte zdarma.

- **Kombinované kočárky**
- **Sportovní a golfové kočárky**
- **Sourozenecké kočárky** a fusaky

Filtrujte podle ceny, stavu, věku dítěte nebo lokality a vyzkoušejte kočárek přímo u prodejce.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'deti' AND c.slug = 'kocarky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Autosedačky

Bezpečí dítěte v autě je na prvním místě. Na Dejinzerat.cz najdete autosedačky pro všechny věkové kategorie od rodičů z celé ČR. Inzerát přidáte zdarma.

- **Vajíčka** pro novorozence
- **Autosedačky** pro batolata a předškoláky
- **Podsedáky**, základny Isofix a doplňky

Filtrujte podle ceny, stavu, věku dítěte nebo lokality a vyberte sedačku, která vaše dítě ochrání.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'deti' AND c.slug = 'autosedacky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Dětské oblečení

Děti z oblečení rychle vyrostou. Na Dejinzerat.cz najdete dětské oblečení od rodičů z celé ČR, často téměř nové. Co je vašim dětem malé, prodáte nebo darujete zdarma.

- **Oblečení pro miminka**
- **Oblečení pro batolata** a předškoláky
- **Bundy, kombinézy** a dětská obuv

Filtrujte podle věku dítěte, velikosti, ceny, stavu nebo lokality a ušetřete na dětském šatníku.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'deti' AND c.slug = 'detske-obleceni' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Hračky

Radost pro děti nemusí stát moc peněz. Na Dejinzerat.cz najdete hračky od rodičů z celé ČR. Hračky, se kterými si už nikdo nehraje, prodáte nebo darujete zdarma.

- **Stavebnice** a společenské hry
- **Plyšáci**, panenky a autíčka
- **Odrážedla**, koloběžky a hračky na ven

Filtrujte podle věku dítěte, ceny, stavu nebo lokality a udělejte dětem radost.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'deti' AND c.slug = 'hracky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Dětský nábytek

Zařizujete dětský pokoj? Na Dejinzerat.cz najdete dětský nábytek od rodičů z celé ČR. Postýlku nebo stoleček, ze kterých dítě vyrostlo, prodáte zdarma.

- **Postýlky** a dětské postele
- **Přebalovací pulty** a komody
- **Dětské stolky, židličky** a psací stoly

Filtrujte podle věku dítěte, ceny, stavu nebo lokality a vytvořte dětem útulný pokojíček.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'deti' AND c.slug = 'detsky-nabytek' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Kola a cyklistika

Vyrazte na kolo bez velké investice. Na Dejinzerat.cz najdete nová i použitá kola a vybavení od cyklistů z celé ČR. Své kolo prodáte, inzerát přidáte zdarma.

- **Horská, silniční** a gravel kola
- **Elektrokola** a dětská kola
- **Helmy, oblečení** a cyklo doplňky

Filtrujte podle značky, velikosti rámu a kol, ceny, stavu nebo lokality a najděte kolo, které vám padne.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sport' AND c.slug = 'cyklistika' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Zimní sporty

Připravte se na sezónu výhodně. Na Dejinzerat.cz najdete lyže, snowboardy i brusle od sportovců z celé ČR. Výbavu, ze které jste vyrostli, prodáte zdarma.

- **Sjezdové a běžecké lyže**
- **Snowboardy** a lyžařské boty
- **Brusle**, helmy a zimní oblečení

Filtrujte podle značky, ceny, stavu nebo lokality a vyrazte na hory s novou výbavou.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sport' AND c.slug = 'zimni-sporty' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Fitness a posilování

Cvičte doma bez drahé permanentky. Na Dejinzerat.cz najdete fitness vybavení od prodejců z celé ČR. Stroje, na kterých už necvičíte, prodáte zdarma.

- **Běžecké pásy**, rotopedy a trenažéry
- **Činky**, kotouče a posilovací lavice
- **Podložky**, gumy a doplňky na cvičení

Filtrujte podle značky, ceny, stavu nebo lokality a začněte cvičit ještě dnes.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sport' AND c.slug = 'fitness' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Turistika a kempování

Vyrazte do přírody dobře vybaveni. Na Dejinzerat.cz najdete turistické a kempingové vybavení od prodejců z celé ČR. Výbavu, kterou už nevyužijete, prodáte zdarma.

- **Stany**, spacáky a karimatky
- **Batohy** a turistická obuv
- **Vařiče**, nádobí a kempingový nábytek

Filtrujte podle značky, ceny, stavu nebo lokality a naplánujte si další výlet.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sport' AND c.slug = 'turistika' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Vodní sporty

Užijte si léto na vodě. Na Dejinzerat.cz najdete vybavení pro vodní sporty od prodejců z celé ČR. Svou výbavu prodáte, inzerát přidáte zdarma.

- **Paddleboardy** a kajaky
- **Lodě**, kánoe a pádla
- **Neopreny**, vesty a potápěčské vybavení

Filtrujte podle značky, ceny, stavu nebo lokality a vyrazte na vodu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sport' AND c.slug = 'vodni-sporty' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Míčové sporty

Hrajete fotbal, hokej nebo tenis? Na Dejinzerat.cz najdete vybavení pro míčové a týmové sporty od sportovců z celé ČR. Nepotřebnou výbavu prodáte zdarma.

- **Fotbal**, florbal a hokej
- **Tenis**, badminton a stolní tenis
- **Basketbal, volejbal** a dresy

Filtrujte podle značky, ceny, stavu nebo lokality a připravte se na další zápas.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sport' AND c.slug = 'micove-sporty' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Psi a štěňata

Hledáte věrného parťáka? Na Dejinzerat.cz najdete štěňata i dospělé psy od chovatelů a majitelů z celé ČR. Inzerát přidáte zdarma, prosíme jen o zodpovědný přístup ke zvířatům.

- **Štěňata s průkazem původu** od chovatelů
- **Psi bez průkazu** a kříženci
- **Psi k adopci** hledající nový domov

Filtrujte podle ceny, pohlaví, průkazu původu nebo lokality a před koupí se se psem vždy osobně seznamte.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'zvirata' AND c.slug = 'psi' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Kočky a koťata

Chcete doma předoucího společníka? Na Dejinzerat.cz najdete koťata i dospělé kočky od chovatelů a majitelů z celé ČR. Inzerát přidáte zdarma, prosíme o zodpovědný přístup ke zvířatům.

- **Koťata s průkazem původu**
- **Domácí kočky** a kříženci
- **Kočky k adopci**

Filtrujte podle ceny, pohlaví, průkazu původu nebo lokality a najděte kočku, která k vám zapadne.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'zvirata' AND c.slug = 'kocky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Hlodavci

Malý mazlíček dokáže udělat velkou radost. Na Dejinzerat.cz najdete hlodavce od chovatelů z celé ČR. Inzerát přidáte zdarma, prosíme o zodpovědný přístup ke zvířatům.

- **Králíci** a morčata
- **Křečci**, myši a potkani
- **Činčily** a osmáci

Filtrujte podle ceny, pohlaví nebo lokality a najděte chovatele ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'zvirata' AND c.slug = 'hlodavci' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Ptáci

Zpěv a barvy v domácnosti i na dvoře. Na Dejinzerat.cz najdete okrasné ptactvo od chovatelů z celé ČR. Inzerát přidáte zdarma, prosíme o zodpovědný přístup ke zvířatům.

- **Andulky**, korely a papoušci
- **Kanárci** a drobní exoti
- **Holubi** a okrasná drůbež

Filtrujte podle ceny, pohlaví nebo lokality a najděte opeřeného společníka.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'zvirata' AND c.slug = 'ptaci' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Akvaristika a teraristika

Vytvořte si doma kousek přírody. Na Dejinzerat.cz najdete akvarijní ryby, terarijní zvířata i vybavení od chovatelů z celé ČR. Inzerát přidáte zdarma.

- **Akvarijní ryby** a vodní rostliny
- **Plazi**, obojživelníci a bezobratlí
- **Akvária, terária** a technika

Filtrujte podle ceny nebo lokality a najděte vše pro své akvárium či terárium.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'zvirata' AND c.slug = 'akvaristika' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Chovatelské potřeby

Vše, co váš mazlíček potřebuje. Na Dejinzerat.cz najdete chovatelské potřeby od prodejců z celé ČR. Věci, které už nevyužijete, prodáte nebo darujete zdarma.

- **Pelíšky**, boudy a přepravky
- **Klece**, výběhy a voliéry
- **Krmivo**, misky, obojky a hračky

Filtrujte podle ceny, stavu nebo lokality a dopřejte zvířeti pohodlí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'zvirata' AND c.slug = 'chovatelske-potreby' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Nabídka práce

Hledáte novou práci? Na Dejinzerat.cz najdete pracovní nabídky od firem i živnostníků z celé ČR. Hledáte zaměstnance? Pracovní inzerát přidáte zdarma za pár minut.

- **Práce na plný úvazek**
- **Částečný úvazek**, DPP a DPČ
- **Spolupráce na IČO** a práce z home office

Filtrujte podle typu úvazku, mzdy nebo lokality a najděte práci, která vás bude bavit.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'prace' AND c.slug = 'nabidka-prace' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Brigády

Chcete si přivydělat? Na Dejinzerat.cz najdete brigády pro studenty, důchodce i všechny, kdo hledají přivýdělek, z celé ČR. Brigádníky sháníte zdarma.

- **Letní a sezónní brigády**
- **Víkendové a večerní** brigády
- **Jednorázové výpomoci** a krátkodobé práce

Filtrujte podle typu úvazku, mzdy nebo lokality a najděte brigádu blízko domova.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'prace' AND c.slug = 'brigady' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Hledám práci

Představte se zaměstnavatelům sami. Na Dejinzerat.cz přidáte zdarma inzerát, ve kterém popíšete své zkušenosti a jakou práci hledáte. Firmy tu najdou uchazeče z celé ČR.

- **Hledám práci na plný úvazek**
- **Hledám brigádu** nebo částečný úvazek
- **Nabízím spolupráci** na IČO

Filtrujte podle typu úvazku nebo lokality a najděte vhodného kolegu do svého týmu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'prace' AND c.slug = 'hledam-praci' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Řemesla a opravy

Potřebujete šikovné ruce? Na Dejinzerat.cz najdete řemeslníky a opraváře z celé ČR. Jste řemeslník? Své služby nabídnete zdarma.

- **Instalatéři**, elektrikáři a topenáři
- **Malíři, zedníci** a obkladači
- **Opravy spotřebičů**, aut a domácí kutilství

Filtrujte podle ceny, působnosti nebo lokality a najděte řemeslníka ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sluzby' AND c.slug = 'remesla' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Stěhování a doprava

Stěhujete se nebo potřebujete něco odvézt? Na Dejinzerat.cz najdete stěhovací a dopravní služby z celé ČR. Nabízíte dopravu? Inzerát přidáte zdarma.

- **Stěhování** bytů, domů a kanceláří
- **Odvoz nábytku**, odpadu a vyklízení
- **Přeprava materiálu** a autodoprava

Filtrujte podle ceny, působnosti nebo lokality a najděte spolehlivou pomoc.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sluzby' AND c.slug = 'stehovani' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Úklid

Ušetřete čas a nechte úklid na profesionálech. Na Dejinzerat.cz najdete úklidové služby z celé ČR. Nabízíte úklid? Své služby nabídnete zdarma.

- **Úklid domácností** a pravidelný úklid
- **Úklid kanceláří** a společných prostor
- **Mytí oken**, čištění koberců a úklid po rekonstrukci

Filtrujte podle ceny, působnosti nebo lokality a najděte úklid ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sluzby' AND c.slug = 'uklid' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Doučování a kurzy

Chcete se zlepšit ve škole nebo se naučit něco nového? Na Dejinzerat.cz najdete lektory a kurzy z celé ČR i online. Učíte? Inzerát přidáte zdarma.

- **Doučování** matematiky, češtiny a dalších předmětů
- **Jazykové kurzy** a konverzace
- **Hudební, sportovní** a další kurzy

Filtrujte podle ceny, působnosti nebo lokality a najděte lektora, se kterým vás učení bude bavit.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sluzby' AND c.slug = 'douceni' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Krása a zdraví

Dopřejte si péči, kterou si zasloužíte. Na Dejinzerat.cz najdete kadeřnice, kosmetičky, maséry a další služby z celé ČR. Nabízíte služby krásy? Inzerát přidáte zdarma.

- **Kadeřnictví** a barbershopy
- **Kosmetika, manikúra** a pedikúra
- **Masáže** a péče o tělo

Filtrujte podle ceny, působnosti nebo lokality a najděte služby ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sluzby' AND c.slug = 'krasa' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## IT služby a tvorba webu

Potřebujete web, opravit počítač nebo poradit s IT? Na Dejinzerat.cz najdete IT specialisty a webaře z celé ČR i online. Své služby nabídnete zdarma.

- **Tvorba webů** a e-shopů
- **Opravy počítačů** a instalace
- **Grafika**, marketing a správa sítí

Filtrujte podle ceny, působnosti nebo lokality a najděte odborníka, který vám pomůže.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sluzby' AND c.slug = 'it-sluzby' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Elektrické nářadí

Kvalitní nářadí nemusí být drahé. Na Dejinzerat.cz najdete nové i použité elektrické nářadí od prodejců z celé ČR. Nářadí, které už nepotřebujete, prodáte zdarma.

- **Vrtačky** a aku šroubováky
- **Úhlové brusky**, pily a hoblíky
- **Kombo sady** a baterie

Filtrujte podle značky, napájení, ceny, stavu nebo lokality a najděte nářadí pro svou práci.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'stroje-naradi' AND c.slug = 'elektricke-naradi' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Ruční nářadí

Základ každé dílny. Na Dejinzerat.cz najdete ruční nářadí od prodejců z celé ČR. Nepotřebné nářadí prodáte zdarma.

- **Klíče, šroubováky** a kleště
- **Kladiva**, pilky a dláta
- **Měřidla, vodováhy** a sady nářadí v kufru

Filtrujte podle značky, ceny, stavu nebo lokality a doplňte svou výbavu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'stroje-naradi' AND c.slug = 'rucni-naradi' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Stavební stroje

Stavíte nebo podnikáte ve stavebnictví? Na Dejinzerat.cz najdete stavební stroje a techniku od firem i soukromníků z celé ČR. Stroj prodáte nebo pronajmete, inzerát přidáte zdarma.

- **Bagry, minibagry** a nakladače
- **Míchačky**, vibrační desky a pěchy
- **Lešení**, elektrocentrály a kompresory

Filtrujte podle značky, napájení, ceny, stavu nebo lokality a najděte techniku pro svou stavbu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'stroje-naradi' AND c.slug = 'stavebni-stroje' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Zemědělské stroje

Hospodaříte na poli nebo na statku? Na Dejinzerat.cz najdete zemědělské stroje od zemědělců a prodejců z celé ČR. Svůj stroj prodáte, inzerát přidáte zdarma.

- **Traktory** a malotraktory
- **Pluhy, brány** a secí stroje
- **Sklízecí technika**, přívěsy a náhradní díly

Filtrujte podle značky, napájení, ceny, stavu nebo lokality a najděte stroj pro své hospodářství.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'stroje-naradi' AND c.slug = 'zemedelske-stroje' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Dílenské vybavení

Zařizujete dílnu nebo garáž? Na Dejinzerat.cz najdete dílenské vybavení od prodejců z celé ČR. Vybavení, které nepotřebujete, prodáte zdarma.

- **Ponky**, regály a dílenské vozíky
- **Kompresory** a svářečky
- **Stojanové vrtačky**, soustruhy a brusky

Filtrujte podle značky, napájení, ceny, stavu nebo lokality a vybavte si dílnu podle sebe.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'stroje-naradi' AND c.slug = 'dilna' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Kytary a baskytary

Začínáte hrát nebo sháníte lepší nástroj? Na Dejinzerat.cz najdete kytary od muzikantů z celé ČR. Kytaru, na kterou už nehrajete, prodáte zdarma.

- **Akustické a klasické kytary**
- **Elektrické kytary** a baskytary
- **Kytarová komba**, efekty a příslušenství

Filtrujte podle značky, ceny, stavu nebo lokality a vyzkoušejte nástroj přímo u prodejce.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hudba' AND c.slug = 'kytary' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Klávesy a piana

Hrajete na klavír nebo se chcete učit? Na Dejinzerat.cz najdete klávesové nástroje od muzikantů z celé ČR. Svůj nástroj prodáte, inzerát přidáte zdarma.

- **Digitální piana** a keyboardy
- **Klavíry** a pianina
- **Syntezátory** a MIDI klávesy

Filtrujte podle značky, ceny, stavu nebo lokality a najděte nástroj, na který budete rádi hrát.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hudba' AND c.slug = 'klavesy' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Bicí nástroje

Udávejte rytmus. Na Dejinzerat.cz najdete bicí soupravy a perkuse od muzikantů z celé ČR. Bicí, na které už nehrajete, prodáte zdarma.

- **Akustické bicí soupravy**
- **Elektronické bicí**
- **Činely**, perkuse a příslušenství

Filtrujte podle značky, ceny, stavu nebo lokality a najděte soupravu pro svou kapelu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hudba' AND c.slug = 'bici' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Dechové nástroje

Hrajete v kapele, v orchestru nebo se teprve učíte? Na Dejinzerat.cz najdete dechové nástroje od muzikantů z celé ČR. Nepotřebný nástroj prodáte zdarma.

- **Flétny** a klarinety
- **Saxofony**
- **Trubky, trombony** a další žestě

Filtrujte podle značky, ceny, stavu nebo lokality a najděte nástroj, který vám sedne.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hudba' AND c.slug = 'dechove' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Studio a ozvučení

Nahráváte doma nebo hrajete koncerty? Na Dejinzerat.cz najdete studiovou techniku a ozvučení od muzikantů z celé ČR. Techniku prodáte, inzerát přidáte zdarma.

- **Mikrofony** a zvukové karty
- **Mixážní pulty** a studiové monitory
- **Reprosoustavy** a DJ technika

Filtrujte podle značky, ceny, stavu nebo lokality a dovybavte své studio.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hudba' AND c.slug = 'studio' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Gramofonové desky, CD a noty

Sbíráte vinyly nebo hledáte noty? Na Dejinzerat.cz najdete hudební nosiče a noty od sběratelů a muzikantů z celé ČR. Svou sbírku nabídnete zdarma.

- **Vinylové desky** (LP a singly)
- **CD**, kazety a DVD
- **Noty** a zpěvníky

Filtrujte podle ceny, stavu nebo lokality a objevte hudbu, která vám chyběla.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hudba' AND c.slug = 'desky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Mince a bankovky

Sbíráte mince nebo bankovky? Na Dejinzerat.cz najdete numismatické kousky od sběratelů z celé ČR. Svou sbírku nebo zděděné mince nabídnete zdarma.

- **Československé a české mince**
- **Zahraniční mince** a pamětní ražby
- **Bankovky** a papírová platidla

Filtrujte podle období, ceny nebo lokality a rozšiřte svou sbírku.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sberatelstvi' AND c.slug = 'mince' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Poštovní známky

Filatelie je koníček na celý život. Na Dejinzerat.cz najdete známky a celé sbírky od filatelistů z celé ČR. Inzerát přidáte zdarma.

- **Československé a české známky**
- **Zahraniční známky**
- **Alba**, obálky a celistvosti

Filtrujte podle období, ceny nebo lokality a najděte známku, která vám ve sbírce chybí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sberatelstvi' AND c.slug = 'znamky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Starožitnosti

Věci s příběhem a duší. Na Dejinzerat.cz najdete starožitnosti od sběratelů a majitelů z celé ČR. Věci po předcích nabídnete zdarma a najdete pro ně nového majitele.

- **Starožitný nábytek**
- **Porcelán, sklo** a keramika
- **Hodiny**, lampy a předměty z kovu

Filtrujte podle období, ceny, stavu nebo lokality a objevte kousek s historií.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sberatelstvi' AND c.slug = 'starozitnosti' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Obrazy a umění

Ozdobte domov originálním dílem. Na Dejinzerat.cz najdete obrazy a umělecká díla od autorů i sběratelů z celé ČR. Inzerát přidáte zdarma.

- **Obrazy** olejem, akvarely a kresby
- **Grafiky** a tisky
- **Sochy** a umělecké předměty

Filtrujte podle období, ceny nebo lokality a najděte dílo, které vás osloví.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sberatelstvi' AND c.slug = 'umeni' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Modely a figurky

Sběratelské modely pro radost i do sbírky. Na Dejinzerat.cz najdete modely a figurky od sběratelů z celé ČR. Své kousky nabídnete zdarma.

- **Modely aut** a autíček
- **Vláčky** a železniční modely
- **Sběratelské figurky** a vojáčci

Filtrujte podle období, ceny, stavu nebo lokality a doplňte svou sbírku.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sberatelstvi' AND c.slug = 'modely' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Staré knihy a komiksy

Hledáte vzácné vydání nebo starý komiks? Na Dejinzerat.cz najdete staré knihy a sběratelské tisky od sběratelů z celé ČR. Inzerát přidáte zdarma.

- **Antikvariátní knihy** a první vydání
- **Staré mapy**, pohlednice a tisky
- **Sběratelské komiksy** a časopisy

Filtrujte podle období, ceny, stavu nebo lokality a najděte poklad pro svou knihovnu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'sberatelstvi' AND c.slug = 'stare-knihy' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Beletrie

Dejte knihám druhý život. Na Dejinzerat.cz najdete romány, detektivky i poezii od čtenářů z celé ČR. Přečtené knihy prodáte nebo darujete zdarma.

- **Romány** a historické příběhy
- **Detektivky**, thrillery a sci-fi
- **Poezie** a povídky

Filtrujte podle jazyka, vazby, ceny, stavu nebo lokality a najděte své další čtení.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'knihy' AND c.slug = 'beletrie' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Učebnice a skripta

Ušetřete na školních knihách. Na Dejinzerat.cz najdete učebnice a skripta od studentů a rodičů z celé ČR. Učebnice z minulého roku prodáte zdarma.

- **Učebnice pro základní** a střední školy
- **Vysokoškolská skripta**
- **Jazykové učebnice** a pracovní sešity

Filtrujte podle jazyka, ceny, stavu nebo lokality a připravte se na nový školní rok výhodně.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'knihy' AND c.slug = 'ucebnice' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Odborná literatura

Rozšiřte své znalosti levněji. Na Dejinzerat.cz najdete odborné knihy od prodejců z celé ČR. Knihy, které už nepotřebujete, prodáte zdarma.

- **Technika** a IT
- **Medicína**, právo a ekonomie
- **Příručky, slovníky** a encyklopedie

Filtrujte podle jazyka, vazby, ceny, stavu nebo lokality a najděte knihu pro svůj obor.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'knihy' AND c.slug = 'odborna' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Dětské knihy

Čtení od malička. Na Dejinzerat.cz najdete dětské knihy od rodičů z celé ČR. Knihy, ze kterých vaše děti vyrostly, prodáte nebo darujete zdarma.

- **Leporela** a obrázkové knihy
- **Pohádky** a říkanky
- **Knihy pro školáky** a dobrodružné příběhy

Filtrujte podle jazyka, vazby, ceny, stavu nebo lokality a podpořte v dětech lásku ke čtení.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'knihy' AND c.slug = 'detske-knihy' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Komiksy a manga

Milujete příběhy v obrázcích? Na Dejinzerat.cz najdete komiksy a mangu od čtenářů a sběratelů z celé ČR. Svou sbírku nabídnete zdarma.

- **České a zahraniční komiksy**
- **Manga** a grafické romány
- **Superhrdinské série**

Filtrujte podle jazyka, vazby, ceny, stavu nebo lokality a doplňte chybějící díly.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'knihy' AND c.slug = 'komiksy' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Časopisy

Hledáte starší čísla nebo celé ročníky? Na Dejinzerat.cz najdete časopisy od čtenářů a sběratelů z celé ČR. Inzerát přidáte zdarma.

- **Starší čísla** a kompletní ročníky
- **Odborné a hobby časopisy**
- **Dětské a sběratelské časopisy**

Filtrujte podle jazyka, ceny, stavu nebo lokality a najděte číslo, které hledáte.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'knihy' AND c.slug = 'casopisy' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Deskové a karetní hry

Zábava pro rodinu i přátele. Na Dejinzerat.cz najdete deskové a karetní hry od hráčů z celé ČR. Dohrané hry prodáte nebo vyměníte zdarma.

- **Rodinné a párty hry**
- **Strategické hry** a rozšíření
- **Sběratelské karetní hry**, puzzle a hlavolamy

Filtrujte podle ceny, stavu nebo lokality a naplánujte další herní večer.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hobby' AND c.slug = 'deskovky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Modelářství

Stavíte modely nebo létáte s RC technikou? Na Dejinzerat.cz najdete modelářské potřeby od nadšenců z celé ČR. Inzerát přidáte zdarma.

- **Plastikové modely** a stavebnice
- **RC auta, letadla** a lodě
- **Modelová železnice** a příslušenství

Filtrujte podle ceny, stavu nebo lokality a najděte díl, který vašemu modelu chybí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hobby' AND c.slug = 'modelarstvi' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Ruční práce a výtvarné potřeby

Tvoříte rádi vlastníma rukama? Na Dejinzerat.cz najdete materiál a potřeby pro tvoření od prodejců z celé ČR. Nevyužitý materiál prodáte zdarma.

- **Příze**, látky a šicí stroje
- **Barvy, plátna** a štětce
- **Korálky** a potřeby pro kreativní tvoření

Filtrujte podle ceny, stavu nebo lokality a pusťte se do dalšího projektu.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hobby' AND c.slug = 'rucni-prace' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Rybaření

Chystáte se k vodě? Na Dejinzerat.cz najdete rybářské vybavení od rybářů z celé ČR. Výbavu, kterou už nepoužíváte, prodáte zdarma.

- **Pruty** a navijáky
- **Bivaky, lehátka** a křesla
- **Nástrahy**, krmení a rybářské doplňky

Filtrujte podle ceny, stavu nebo lokality a vyrazte na ryby dobře vybaveni.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hobby' AND c.slug = 'rybareni' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Myslivost

Vše pro myslivce a milovníky přírody. Na Dejinzerat.cz najdete myslivecké vybavení od prodejců z celé ČR. Inzerát přidáte zdarma.

- **Optika**, dalekohledy a fotopasti
- **Myslivecké oblečení** a obuv
- **Vybavení do revíru** a trofeje

Filtrujte podle ceny, stavu nebo lokality a doplňte svou výbavu do lesa.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hobby' AND c.slug = 'myslivost' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Zážitky a cestování

Darujte nebo si užijte nevšední zážitek. Na Dejinzerat.cz najdete zážitky, pobyty a cestovní nabídky od prodejců z celé ČR. Nevyužitý zážitek nabídnete zdarma.

- **Zážitkové poukazy**
- **Pobyty** a víkendy
- **Zájezdy** a cestovní vybavení

Filtrujte podle ceny nebo lokality a naplánujte si něco, na co budete dlouho vzpomínat.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'hobby' AND c.slug = 'vstupenky-zazitky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Farmářské potraviny

Poctivé jídlo přímo od farmářů. Na Dejinzerat.cz najdete farmářské potraviny od výrobců z celé ČR. Vyrábíte nebo chováte? Své produkty nabídnete zdarma.

- **Maso** a uzeniny z domácího chovu
- **Mléko, sýry** a vejce
- **Domácí pečivo**, zavařeniny a ovocné mošty

Filtrujte podle ceny, bio a farmářského původu nebo lokality a nakupujte přímo u farmáře ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'potraviny' AND c.slug = 'farmarske' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Ovoce a zelenina

Čerstvé ovoce a zelenina ze zahrad a polí. Na Dejinzerat.cz najdete nabídky pěstitelů z celé ČR. Přebytky ze zahrady nabídnete zdarma.

- **Sezónní ovoce** a zelenina
- **Brambory**, cibule a česnek
- **Bylinky** a sušené plody

Filtrujte podle ceny, bio a farmářského původu nebo lokality a kupte si čerstvé plody přímo od pěstitele.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'potraviny' AND c.slug = 'ovoce-zelenina' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Med a včelí produkty

Med přímo od včelaře. Na Dejinzerat.cz najdete med a včelí produkty od včelařů z celé ČR. Jste včelař? Svůj med nabídnete zdarma.

- **Květový a lesní med**
- **Pastovaný med**, pyl a propolis
- **Včelí vosk**, svíčky a včelařské potřeby

Filtrujte podle ceny, bio a farmářského původu nebo lokality a ochutnejte med ze svého kraje.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'potraviny' AND c.slug = 'med' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Hospodářská zvířata

Chováte na statku nebo na dvoře? Na Dejinzerat.cz najdete hospodářská zvířata od chovatelů z celé ČR. Inzerát přidáte zdarma, prosíme o zodpovědný přístup ke zvířatům.

- **Drůbež** a slepice
- **Kozy, ovce** a prasata
- **Skot** a koně

Filtrujte podle ceny nebo lokality a najděte chovatele ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'potraviny' AND c.slug = 'hospodarska-zvirata' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Zemědělská technika a vybavení

Potřebujete techniku pro malé hospodářství? Na Dejinzerat.cz najdete zemědělské vybavení od zemědělců z celé ČR. Inzerát přidáte zdarma.

- **Malotraktory** a kultivátory
- **Vybavení pro chov** a skladování
- **Nářadí** pro sad, pole a zahradu

Filtrujte podle ceny, stavu nebo lokality a najděte techniku pro své hospodářství.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'potraviny' AND c.slug = 'zemedelska-technika' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Osiva, sazenice a krmiva

Vše pro úrodnou sezónu a dobře živená zvířata. Na Dejinzerat.cz najdete osiva, sazenice i krmiva od pěstitelů a zemědělců z celé ČR. Inzerát přidáte zdarma.

- **Osiva** a sadba
- **Sazenice** zeleniny a bylinek
- **Krmiva**, seno a sláma

Filtrujte podle ceny, bio a farmářského původu nebo lokality a nakupujte od zemědělců ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'potraviny' AND c.slug = 'osiva-sazenice' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Vstupenky a poukazy

Nemůžete na koncert nebo máte nevyužitý poukaz? Na Dejinzerat.cz najdete vstupenky a poukazy od prodejců z celé ČR. Inzerát přidáte zdarma.

- **Vstupenky na koncerty** a festivaly
- **Divadlo**, sport a kulturní akce
- **Dárkové poukazy** a slevové kupony

Filtrujte podle ceny nebo lokality a nenechte si ujít svou akci.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'ostatni' AND c.slug = 'vstupenky' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Daruji zdarma

Věci, které vám už neslouží, mohou udělat radost jiným. Na Dejinzerat.cz najdete věci zdarma od dárců z celé ČR. Darovat můžete i vy, inzerát přidáte zdarma.

- **Nábytek** a vybavení domácnosti
- **Oblečení** a dětské věci
- **Knihy**, hračky a další věci

Filtrujte podle stavu nebo lokality a vyzvedněte si dar ve svém okolí.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'ostatni' AND c.slug = 'darujeme' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Výměna

Proč kupovat, když se dá měnit? Na Dejinzerat.cz najdete nabídky na výměnu věcí od lidí z celé ČR. Inzerát na výměnu přidáte zdarma.

- **Výměna elektroniky** a mobilů
- **Výměna oblečení** a dětských věcí
- **Výměna her**, knih a sběratelských předmětů

Filtrujte podle stavu nebo lokality a najděte protistranu, se kterou se domluvíte.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'ostatni' AND c.slug = 'vymena' AND (c."intro" IS NULL OR btrim(c."intro") = '');

UPDATE "Category" c SET "intro" = $intro$## Různé

Nevíte, kam svůj inzerát zařadit? V kategorii Různé na Dejinzerat.cz najdete vše, co se nevešlo jinam. Inzerát přidáte zdarma za pár minut.

- **Neobvyklé věci** a kuriozity
- **Balíky a směsi** různých věcí
- **Pozůstalosti** a vyklízení

Filtrujte podle ceny, stavu nebo lokality a možná objevíte přesně to, co hledáte.$intro$
FROM "Category" p WHERE c."parentId" = p.id AND p."parentId" IS NULL AND p.slug = 'ostatni' AND c.slug = 'ruzne' AND (c."intro" IS NULL OR btrim(c."intro") = '');
