-- Úvodní (SEO) texty pro 18 hlavních kategorií (Auto-moto a Reality už vyplnil admin).
-- Vyplní se jen tam, kde je text prázdný – úpravy z administrace (/admin/seo) se nikdy nepřepíšou.

UPDATE "Category" SET "intro" = $intro$## Elektronika inzerce zdarma

Sháníte televizi, sluchátka nebo herní konzoli za dobrou cenu? Na Dejinzerat.cz najdete novou i použitou elektroniku od prodejců z celé České republiky. Starý přístroj tu můžete prodat i vy, inzerát přidáte zdarma za pár minut.

- **Televize** a **audio technika**, reproduktory, sluchátka i soundbary
- **Fotoaparáty a video**, objektivy a příslušenství
- **Herní konzole** a hry
- **Domácí spotřebiče** a **chytrá domácnost**

Filtrujte podle ceny, značky, stavu, záruky nebo lokality a najděte elektroniku, která vám udělá radost.$intro$
WHERE "parentId" IS NULL AND "slug" = 'elektronika' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Mobily a příslušenství inzerce zdarma

Chcete levnější mobil nebo prodat ten starý? Na Dejinzerat.cz najdete nové i použité telefony, tablety a chytré hodinky od prodejců z celé České republiky. Inzerát přidáte zdarma a zájemce vás kontaktuje přímo.

- **Mobilní telefony** Apple, Samsung, Xiaomi, Google a dalších značek
- **Chytré hodinky** a fitness náramky
- **Tablety** pro práci, školu i zábavu
- **Příslušenství**, nabíječky, kryty a sluchátka

Filtrujte podle ceny, značky, úložiště, kondice baterie, záruky nebo lokality a vyberte si telefon, který vám sedne.$intro$
WHERE "parentId" IS NULL AND "slug" = 'mobily' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Počítače a IT inzerce zdarma

Hledáte notebook do školy, výkonné PC na hry nebo levný monitor? Na Dejinzerat.cz najdete nové i použité počítače a komponenty od prodejců z celé České republiky. Svou techniku můžete prodat i vy, inzerát přidáte zdarma.

- **Notebooky** a **stolní počítače** všech značek
- **Komponenty**, grafické karty, procesory a disky
- **Monitory**, **periferie a příslušenství**
- **Sítě a servery**, routery a síťové prvky

Filtrujte podle ceny, značky, operační paměti, stavu, záruky nebo lokality a najděte techniku přesně podle svých potřeb.$intro$
WHERE "parentId" IS NULL AND "slug" = 'pocitace' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Nábytek a bydlení inzerce zdarma

Zařizujete byt nebo se zbavujete starého nábytku? Na Dejinzerat.cz najdete sedačky, postele, skříně i doplňky do bytu od prodejců z celé České republiky. Nepotřebný nábytek tu prodáte nebo darujete, inzerát přidáte zdarma.

- **Obývací pokoj**, sedačky, stolky a obývací stěny
- **Ložnice**, postele, matrace a šatní skříně
- **Kuchyně a jídelna** a vybavení **koupelny**
- **Dekorace a doplňky** a **osvětlení**

Filtrujte podle ceny, materiálu, stavu, možnosti dovozu nebo lokality a najděte kousek, který se k vám hodí.$intro$
WHERE "parentId" IS NULL AND "slug" = 'nabytek' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Dům a zahrada inzerce zdarma

Chystáte se na stavbu, rekonstrukci nebo práci na zahradě? Na Dejinzerat.cz najdete vše pro dům a zahradu od prodejců z celé České republiky. Co vám zbylo, můžete prodat i vy, inzerát přidáte zdarma.

- **Zahradní technika**, sekačky, křovinořezy a vysavače listí
- **Zahradní nábytek**, **bazény a vířivky**
- **Rostliny a semena** pro zahradu i balkon
- **Stavebniny**, **vytápění a klimatizace**

Filtrujte podle ceny, stavu, možnosti dovozu nebo lokality a najděte, co potřebujete, ve svém okolí.$intro$
WHERE "parentId" IS NULL AND "slug" = 'dum-zahrada' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Oblečení a obuv inzerce zdarma

Hledáte značkové oblečení za zlomek ceny nebo chcete udělat místo ve skříni? Na Dejinzerat.cz najdete nové i nošené oblečení a boty od prodejců z celé České republiky. Inzerát přidáte zdarma za pár minut.

- **Dámské** a **pánské oblečení** všech velikostí
- **Obuv**, tenisky, kozačky i společenské boty
- **Doplňky a šperky**
- **Kabelky a tašky**

Filtrujte podle ceny, velikosti, značky, stavu nebo lokality a najděte oblečení, které vám padne.$intro$
WHERE "parentId" IS NULL AND "slug" = 'obleceni' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Děti a kojenecké potřeby inzerce zdarma

Děti rychle rostou a věci po nich často zůstanou skoro nové. Na Dejinzerat.cz najdete kočárky, oblečení i hračky od rodičů z celé České republiky. To, z čeho vaše dítě vyrostlo, tu prodáte nebo darujete, inzerát přidáte zdarma.

- **Kočárky** a **autosedačky**
- **Dětské oblečení** od miminek po školáky
- **Hračky** a hry
- **Dětský nábytek**, postýlky a pokojíčky

Filtrujte podle ceny, věku dítěte, stavu nebo lokality a ušetřete na všem, co vaše dítě potřebuje.$intro$
WHERE "parentId" IS NULL AND "slug" = 'deti' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Sport a volný čas inzerce zdarma

Chcete začít sportovat a nechcete hned utrácet za nové vybavení? Na Dejinzerat.cz najdete kola, lyže i vybavení na túry od prodejců z celé České republiky. Sportovní věci, které už nevyužijete, prodáte i vy, inzerát přidáte zdarma.

- **Cyklistika**, horská, silniční i elektrokola
- **Zimní sporty**, lyže, snowboardy a brusle
- **Fitness a posilování**, **míčové sporty**
- **Turistika a kempování** a **vodní sporty**

Filtrujte podle ceny, značky, stavu nebo lokality a najděte vybavení pro svůj oblíbený sport.$intro$
WHERE "parentId" IS NULL AND "slug" = 'sport' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Zvířata a chovatelské potřeby inzerce zdarma

Hledáte nového člena rodiny nebo vybavení pro svého mazlíčka? Na Dejinzerat.cz najdete inzeráty chovatelů i majitelů zvířat z celé České republiky. Inzerát přidáte zdarma, prosíme jen o zodpovědný přístup ke zvířatům.

- **Psi** a **kočky** s průkazem původu i bez něj
- **Hlodavci** a **ptáci**
- **Akvaristika a teraristika**
- **Chovatelské potřeby**, krmiva, pelíšky a klece

Filtrujte podle ceny, pohlaví, průkazu původu nebo lokality a najděte zvíře či potřeby ve svém okolí.$intro$
WHERE "parentId" IS NULL AND "slug" = 'zvirata' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Práce a brigády inzerce zdarma

Hledáte novou práci, přivýdělek nebo šikovné kolegy do týmu? Na Dejinzerat.cz najdete nabídky práce a brigád z celé České republiky. Pracovní nabídku i inzerát „hledám práci“ přidáte zdarma za pár minut.

- **Nabídka práce** na plný i částečný úvazek
- **Brigády** pro studenty, na léto i na víkendy
- **Hledám práci**, kde se uchazeči představí sami
- Práce na **DPP/DPČ**, na **IČO** i z **home office**

Filtrujte podle typu úvazku, mzdy nebo lokality a najděte práci, která vám bude vyhovovat.$intro$
WHERE "parentId" IS NULL AND "slug" = 'prace' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Služby a řemesla inzerce zdarma

Potřebujete řemeslníka, pomoc se stěhováním nebo doučování? Na Dejinzerat.cz najdete nabídky služeb od živnostníků i firem z celé České republiky. Své služby tu můžete nabízet i vy, inzerát přidáte zdarma.

- **Řemesla a opravy**, instalatéři, elektrikáři i malíři
- **Stěhování a doprava**
- **Úklid** domácností i firem
- **Doučování a kurzy**, **krása a zdraví**, **IT a web**

Filtrujte podle ceny, působnosti nebo lokality a najděte spolehlivou službu ve svém okolí, nebo i online.$intro$
WHERE "parentId" IS NULL AND "slug" = 'sluzby' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Stroje a nářadí inzerce zdarma

Hledáte vrtačku, pilu nebo stroj na stavbu za rozumnou cenu? Na Dejinzerat.cz najdete nové i použité nářadí a stroje od prodejců z celé České republiky. Nářadí, které už nepotřebujete, prodáte i vy, inzerát přidáte zdarma.

- **Elektrické nářadí** Bosch, Makita, DeWalt a dalších značek
- **Ruční nářadí**
- **Stavební stroje** a **zemědělské stroje**
- **Dílenské vybavení**, ponky, kompresory a svářečky

Filtrujte podle ceny, značky, napájení, stavu nebo lokality a najděte nářadí do dílny i na stavbu.$intro$
WHERE "parentId" IS NULL AND "slug" = 'stroje-naradi' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Hudba a hudební nástroje inzerce zdarma

Začínáte hrát, nebo sháníte lepší nástroj? Na Dejinzerat.cz najdete nové i použité hudební nástroje a techniku od muzikantů z celé České republiky. Nástroj, na který už nehrajete, prodáte i vy, inzerát přidáte zdarma.

- **Kytary a baskytary**, akustické i elektrické
- **Klávesy a piana**, **bicí nástroje**
- **Dechové nástroje**
- **Studio a ozvučení**, **desky, CD a noty**

Filtrujte podle ceny, značky, stavu nebo lokality a najděte nástroj, se kterým vás hraní bude bavit.$intro$
WHERE "parentId" IS NULL AND "slug" = 'hudba' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Sběratelství a starožitnosti inzerce zdarma

Rozšiřujete svou sbírku nebo chcete prodat věci po předcích? Na Dejinzerat.cz najdete mince, známky, starožitnosti i umění od sběratelů z celé České republiky. Inzerát přidáte zdarma a oslovíte nadšence, kteří hledají právě vaše kousky.

- **Mince a bankovky**, **známky**
- **Starožitnosti**, nábytek, porcelán a hodiny
- **Obrazy a umění**
- **Modely a figurky**, **staré knihy a komiksy**

Filtrujte podle ceny, období, stavu nebo lokality a objevte vzácné kousky do své sbírky.$intro$
WHERE "parentId" IS NULL AND "slug" = 'sberatelstvi' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Knihy a učebnice inzerce zdarma

Máte doma přečtené knihy nebo hledáte levné učebnice na nový školní rok? Na Dejinzerat.cz najdete nové i použité knihy od prodejců z celé České republiky. Knihám dáte druhý život, inzerát přidáte zdarma.

- **Beletrie**, romány, detektivky i poezie
- **Učebnice a skripta** pro základní, střední i vysoké školy
- **Odborná literatura** a **dětské knihy**
- **Komiksy a manga**, **časopisy**

Filtrujte podle ceny, jazyka, vazby, stavu nebo lokality a najděte knihu, která vám udělá radost.$intro$
WHERE "parentId" IS NULL AND "slug" = 'knihy' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Hobby a volný čas inzerce zdarma

Hledáte vybavení pro svého koníčka nebo tip na zážitek? Na Dejinzerat.cz najdete inzeráty nadšenců z celé České republiky. Věci, které už nevyužijete, prodáte i vy, inzerát přidáte zdarma za pár minut.

- **Deskové a karetní hry**
- **Modelářství**, stavebnice a modely
- **Ruční práce a výtvarné potřeby**
- **Rybaření**, **myslivost** a **zážitky a cestování**

Filtrujte podle ceny, stavu nebo lokality a najděte vše pro svůj volný čas ve svém okolí.$intro$
WHERE "parentId" IS NULL AND "slug" = 'hobby' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Potraviny a zemědělství inzerce zdarma

Chcete nakupovat poctivé potraviny přímo od farmářů? Na Dejinzerat.cz najdete nabídky pěstitelů, chovatelů a zemědělců z celé České republiky. Své výpěstky nebo techniku tu nabídnete i vy, inzerát přidáte zdarma.

- **Farmářské potraviny**, maso, sýry a vejce
- **Ovoce a zelenina**, **med a včelí produkty**
- **Hospodářská zvířata**
- **Zemědělská technika**, **osiva, sazenice a krmiva**

Filtrujte podle ceny, bio a farmářského původu nebo lokality a nakupujte čerstvé zboží ve svém okolí.$intro$
WHERE "parentId" IS NULL AND "slug" = 'potraviny' AND ("intro" IS NULL OR btrim("intro") = '');

UPDATE "Category" SET "intro" = $intro$## Ostatní inzerce zdarma

Nevíte, kam svůj inzerát zařadit? V kategorii Ostatní na Dejinzerat.cz najdete vše, co se nevešlo jinam, od prodejců z celé České republiky. Inzerát tu přidáte zdarma za pár minut a rychle oslovíte nové zájemce.

- **Vstupenky a poukazy** na koncerty, divadlo i zážitky
- **Daruji zdarma**, věci, které vám už neslouží
- **Výměna**, když chcete něco vyměnit místo prodeje
- **Různé**, vše ostatní

Filtrujte podle ceny, typu nabídky, stavu nebo lokality a možná objevíte přesně to, co jste hledali.$intro$
WHERE "parentId" IS NULL AND "slug" = 'ostatni' AND ("intro" IS NULL OR btrim("intro") = '');
