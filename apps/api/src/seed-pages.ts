import { createHash } from 'crypto';

/**
 * Informační a právní stránky vkládané seedem.
 *
 * Texty jsou NÁVRHY – před spuštěním je musí zkontrolovat právník. Obsah používá jednoduchý Markdown
 * (## nadpis, - odrážka, **tučně**, [odkaz](/cesta), > upozornění) a zástupné značky, které web při zobrazení
 * nahradí údaji provozovatele (systémová nastavení → proměnné OPERATOR_* → zřetelný zástupný text):
 * {{provozovatel}}, {{ico}}, {{sidlo}}, {{rejstrik}}, {{email}}, {{telefon}}, {{dsa_email}}, {{web}}.
 */
export interface SeedPage { slug: string; title: string; description: string; content: string }

export const DRAFT_NOTE = '> **Návrh – před spuštěním zkontroluje právník.** Text zatím není závazný. Údaje v hranatých závorkách doplní provozovatel v administraci.';

/** Původní zástupné texty z prvních verzí seedu – jen ty smí seed přepsat novým zněním. */
export const OLD_PLACEHOLDERS: Record<string, string[]> = {
  podminky: ['Používáním portálu Dejinzerat.cz souhlasíte s těmito podmínkami…\n\n(Text doplní provozovatel v administraci.)'],
  'ochrana-udaju': ['Osobní údaje zpracováváme v souladu s nařízením GDPR. Máte právo na přístup, opravu, výmaz a přenositelnost údajů – export i smazání účtu najdete v Nastavení účtu.\n\n(Podrobný text doplní provozovatel.)'],
  napoveda: ['Jak vložit inzerát, jak funguje topování, jak si uložit hledání… (text doplní provozovatel).'],
  kontakt: ['Dejinzerat.cz – podpora: podpora@dejinzerat.cz'],
};

export const hashContent = (s: string) => createHash('sha256').update(s.replace(/\r\n/g, '\n').trim()).digest('hex').slice(0, 32);

/**
 * Co udělat se stránkou při seedu:
 * - create: stránka neexistuje,
 * - update: obsah je pořád původní zástupný text, nebo ho od posledního seedu nikdo neupravil (otisk sedí),
 * - skip: správce text upravil (nebo je už aktuální).
 */
export function pagePlan(existing: { content: string; seededHash: string | null } | null, def: SeedPage): 'create' | 'update' | 'skip' {
  if (!existing) return 'create';
  const cur = existing.content.replace(/\r\n/g, '\n').trim();
  if (cur === def.content.trim()) return 'skip';
  if ((OLD_PLACEHOLDERS[def.slug] ?? []).some((p) => p.trim() === cur)) return 'update';
  if (existing.seededHash && existing.seededHash === hashContent(existing.content)) return 'update';
  return 'skip';
}

const p = (slug: string, title: string, description: string, ...blocks: string[]): SeedPage => ({ slug, title, description, content: blocks.join('\n\n') });

export const SEED_PAGES: SeedPage[] = [
  p('podminky', 'Podmínky používání', 'Pravidla používání inzertního portálu Dejinzerat.cz: registrace, vkládání inzerátů, odpovědnost, placené služby a řešení sporů.',
    DRAFT_NOTE,
    '## 1. Úvodní ustanovení',
    'Tyto podmínky upravují používání inzertního portálu Dejinzerat.cz (dále jen „portál“), který provozuje **{{provozovatel}}**, IČO {{ico}}, se sídlem {{sidlo}}, zapsaná v {{rejstrik}} (dále jen „provozovatel“). Kontakt: {{email}}, {{telefon}}.',
    'Portál je on-line platforma, na které uživatelé zveřejňují inzeráty a navzájem se kontaktují. Provozovatel není stranou smluv uzavřených mezi uživateli, neprodává inzerované zboží ani služby a za jejich vlastnosti, cenu ani plnění neodpovídá.',
    'Používáním portálu (prohlížením, registrací nebo vložením inzerátu) potvrzujete, že jste se s podmínkami seznámili a souhlasíte s nimi.',
    '## 2. Uživatelský účet',
    '- Prohlížet a hledat inzeráty můžete bez registrace. Pro vložení inzerátu, psaní zpráv a ukládání oblíbených je potřeba účet.\n- Účet může založit fyzická osoba starší 15 let, podnikatel nebo právnická osoba. Údaje v účtu musí být pravdivé a aktuální.\n- Přihlašovací údaje chraňte a nesdělujte je dalším osobám. Za činnost na svém účtu odpovídáte vy.\n- Podnikatel je povinen v profilu uvést, že jedná jako podnikatel, a vyplnit obchodní firmu a IČO.\n- Účet můžete kdykoli zrušit v nastavení účtu.',
    '## 3. Inzeráty',
    '- Základní inzerát je zdarma. Inzerát je zveřejněn po dobu 30 dní a lze jej prodloužit.\n- Inzerát musí odpovídat [Pravidlům inzerování](/stranka/pravidla-inzerovani), pravdivě popisovat nabízené zboží nebo službu a být zařazen do správné kategorie.\n- Vložením inzerátu prohlašujete, že k nabízené věci a k použitým fotografiím a textům máte potřebná práva.\n- Udělujete provozovateli bezplatnou nevýhradní licenci k užití obsahu inzerátu (text, fotografie, video) v rozsahu nutném pro provoz a propagaci portálu po dobu zveřejnění inzerátu.',
    '## 4. Moderace a omezení obsahu',
    'Provozovatel může inzerát nebo jiný obsah odmítnout, skrýt, odstranit, omezit jeho viditelnost nebo pozastavit či zrušit účet, pokud obsah porušuje právní předpisy, tyto podmínky nebo Pravidla inzerování. K moderaci používáme automatickou kontrolu (pravidla pro odhalování zakázaného zboží a podvodů) a lidské moderátory. Automatika sama inzerát trvale neodstraňuje – rizikové inzeráty jen pošle ke kontrole člověku.',
    'O omezení vás budeme informovat a uvedeme důvody (čl. 17 nařízení (EU) 2022/2065, dále jen „DSA“). Proti rozhodnutí můžete do 6 měsíců bezplatně podat [námitku](/namitka). Námitku posoudí jiná osoba, než která rozhodovala. Máte také právo obrátit se na certifikovaný orgán mimosoudního řešení sporů nebo na soud.',
    'Postup pro oznámení nezákonného obsahu popisuje stránka [Nahlašování nezákonného obsahu](/stranka/nahlasovani-obsahu).',
    '## 5. Komunikace mezi uživateli',
    'Zprávy slouží jen k domluvě o inzerovaném zboží nebo službě. Je zakázáno rozesílat nevyžádaná sdělení, obtěžovat ostatní nebo je navádět k platbám mimo bezpečné kanály. Zprávy, které vypadají jako podvod, můžeme automaticky označit varováním.',
    '## 6. Hodnocení',
    'Hodnotit prodejce je možné jen po skutečné konverzaci k inzerátu, a to jednou za konverzaci. Hodnocení musí být pravdivé a věcné. Provozovatel nekupuje ani neupravuje hodnocení a odstraní hodnocení, které porušuje tyto podmínky.',
    '## 7. Placené služby',
    'Topování, zvýraznění a další placené služby se řídí [Podmínkami placených služeb](/stranka/podminky-placenych-sluzeb) a aktuálním [ceníkem](/cenik).',
    '## 8. Odpovědnost',
    '- Provozovatel neodpovídá za obsah inzerátů a zpráv vložených uživateli, ani za uskutečnění, kvalitu či legálnost obchodů mezi nimi. To nevylučuje povinnost provozovatele odstranit nezákonný obsah, o kterém se dozví.\n- Provozovatel usiluje o nepřetržitý provoz portálu, nezaručuje však jeho dostupnost bez výpadků.\n- Doporučení pro bezpečný obchod najdete na stránce [Jak nakupovat bezpečně](/stranka/bezpecny-nakup).',
    '## 9. Ochrana osobních údajů',
    'Zpracování osobních údajů popisují [Zásady zpracování osobních údajů](/stranka/ochrana-udaju) a [Zásady používání cookies](/stranka/cookies).',
    '## 10. Spotřebitelé',
    'Informace o postavení spotřebitelů, právech z vadného plnění a mimosoudním řešení sporů najdete na stránce [Informace pro spotřebitele](/stranka/spotrebitele).',
    '## 11. Změny podmínek',
    'Podmínky můžeme měnit, zejména kvůli změně právních předpisů nebo funkcí portálu. O podstatné změně vás informujeme e-mailem nebo na portálu nejméně 15 dní předem. Pokud se změnou nesouhlasíte, můžete účet zrušit.',
    '## 12. Závěrečná ustanovení',
    'Vztahy neupravené těmito podmínkami se řídí právem České republiky, zejména zákonem č. 89/2012 Sb., občanský zákoník. Dozor nad dodržováním povinností podle DSA v ČR vykonává Český telekomunikační úřad (koordinátor digitálních služeb).',
  ),

  p('ochrana-udaju', 'Zásady zpracování osobních údajů', 'Jaké osobní údaje Dejinzerat.cz zpracovává, proč, jak dlouho, komu je předává a jaká máte práva podle GDPR.',
    DRAFT_NOTE,
    '## 1. Správce osobních údajů',
    'Správcem je **{{provozovatel}}**, IČO {{ico}}, se sídlem {{sidlo}} (dále jen „my“). Ve věcech ochrany osobních údajů nás kontaktujte na {{email}}.',
    '## 2. Jaké údaje zpracováváme a proč',
    '- **Účet:** e-mail, jméno, heslo (jen v zašifrované podobě – hash), případně telefon, fotografie, lokalita, popis profilu, u firem obchodní firma a IČO. Účel: vedení účtu a poskytování služeb portálu. Právní základ: plnění smlouvy (čl. 6 odst. 1 písm. b) GDPR).\n- **Inzeráty:** texty, fotografie (bez údajů EXIF a GPS, které při nahrání odstraňujeme), cena, lokalita. Účel: zveřejnění inzerátu. Právní základ: plnění smlouvy.\n- **Zprávy mezi uživateli:** obsah zpráv a přiložené fotografie. Účel: zprostředkování komunikace, ochrana před podvody. Právní základ: plnění smlouvy a oprávněný zájem na bezpečnosti portálu.\n- **Ověření e-mailu a telefonu:** jednorázové kódy. Účel: ověření účtu a prevence podvodů. Právní základ: oprávněný zájem.\n- **Technické údaje:** IP adresa, údaje o přihlášení a zařízení, záznamy o bezpečnostních událostech. Účel: zabezpečení, prevence zneužití, omezení počtu požadavků. Právní základ: oprávněný zájem.\n- **Oznámení nezákonného obsahu a námitky:** jméno a e-mail oznamovatele, obsah oznámení, rozhodnutí. Účel: plnění povinností podle DSA. Právní základ: právní povinnost (čl. 6 odst. 1 písm. c) GDPR).\n- **Uložená hledání a upozornění:** parametry hledání. Účel: zasílání upozornění, která jste si zapnuli. Právní základ: plnění smlouvy.\n- **Moderace:** automatické skóre rizika inzerátu a rozhodnutí moderátorů. Účel: ochrana uživatelů a dodržení právních předpisů. Právní základ: oprávněný zájem a právní povinnost.',
    'Automatizované rozhodování s právními účinky (čl. 22 GDPR) neprovádíme – o odstranění obsahu a zablokování účtu vždy rozhoduje člověk.',
    '## 3. Jak dlouho údaje uchováváme',
    '- Údaje účtu po dobu jeho existence. Po zrušení účtu osobní údaje anonymizujeme, inzeráty odstraníme a zprávy oddělíme od vaší identity.\n- Neaktivní inzeráty (vypršelé, prodané, smazané) nejvýše 12 měsíců – kvůli vyřízení případných námitek a sporů.\n- Oznámení podle DSA a záznamy o rozhodnutích 3 roky od vyřízení.\n- Bezpečnostní a technické záznamy nejvýše 6 měsíců, záložní kopie databáze 30 dní.\n- Údaje potřebné k vymáhání nároků nebo plnění zákonných povinností (např. účetní doklady za placené služby) po dobu stanovenou zákonem.',
    '## 4. Komu údaje předáváme',
    'Údaje zpracovávají naši zpracovatelé na základě smlouvy o zpracování a jen v nezbytném rozsahu:',
    '- Vercel Inc. – hosting webu a úložiště fotografií (Vercel Blob),\n- Supabase Inc. – databáze (servery v EU, Frankfurt),\n- Resend (Plus Five Five, Inc.) – odesílání e-mailů,\n- GoSMS.cz – odesílání ověřovacích SMS,\n- Cloudflare, Inc. – ochrana formulářů před roboty (Turnstile),\n- Google LLC a Apple Inc. – jen pokud se přihlásíte jejich účtem; získáme e-mail a jméno.',
    'Někteří zpracovatelé sídlí v USA. Předání je chráněno rozhodnutím Evropské komise o odpovídající ochraně (EU–U.S. Data Privacy Framework) nebo standardními smluvními doložkami.',
    'Veřejně viditelné jsou jen údaje, které sami zveřejníte v inzerátu nebo profilu (jméno, lokalita, fotografie, hodnocení). Telefon se zobrazí jen přihlášeným uživatelům, pokud jste ho zveřejnili. Orgánům veřejné moci předáváme údaje jen tehdy, když to ukládá zákon.',
    '## 5. Vaše práva',
    '- **přístup** k údajům a jejich **export** – v Nastavení účtu stáhnete všechna svá data,\n- **oprava** nepřesných údajů – přímo v profilu,\n- **výmaz** („právo být zapomenut“) – zrušení účtu v Nastavení účtu,\n- **omezení zpracování** a **přenositelnost**,\n- **námitka** proti zpracování založenému na oprávněném zájmu,\n- **odvolání souhlasu**, pokud zpracování na souhlasu stojí,\n- **stížnost** u Úřadu pro ochranu osobních údajů (www.uoou.cz).',
    'Žádosti vyřizujeme bez zbytečného odkladu, nejpozději do 1 měsíce. Pište na {{email}}.',
    '## 6. Zabezpečení',
    'Hesla ukládáme jen jako hash, přihlášení používá zabezpečené cookie, přenos je šifrovaný (HTTPS), přístup k údajům mají jen pověření pracovníci a činnosti správců zaznamenáváme do auditního logu. Databázi pravidelně zálohujeme.',
    '## 7. Cookies',
    'Používání cookies a podobných technologií popisují [Zásady používání cookies](/stranka/cookies).',
  ),

  p('pravidla-inzerovani', 'Pravidla inzerování', 'Co lze a nelze inzerovat na Dejinzerat.cz: zakázané zboží a služby, pravidla pro texty a fotografie, firemní inzerce.',
    DRAFT_NOTE,
    'Chceme, aby se na Dejinzerat.cz nakupovalo bezpečně. Inzeráty, které porušují tato pravidla, zamítneme nebo odstraníme a při opakovaném porušování můžeme zablokovat účet.',
    '## Zakázané zboží a služby',
    '- **zbraně a střelivo** – palné zbraně, jejich hlavní části, střelivo, munice, výbušniny a pyrotechnika kategorie F3, F4 a T2; plynové a expanzní zbraně a zbraně kategorie C a D jen v souladu se zákonem o zbraních (v inzerátu uveďte, že kupující musí splňovat zákonné podmínky),\n- **drogy a omamné látky** – včetně konopí s obsahem THC nad zákonný limit, prekurzorů a pomůcek k výrobě drog,\n- **léky na předpis**, doplňky stravy s neschválenými účinky, zdravotnické prostředky bez označení CE,\n- **padělky a napodobeniny** značkového zboží, nelegální kopie software, filmů, her a hudby, prolomené licence a účty,\n- **doklady a osobní údaje** – občanské průkazy, řidičské průkazy, cestovní pasy, SPZ, databáze kontaktů, vylosované účty,\n- **erotické služby**, eskort, pornografie a jakýkoli obsah se sexuálním zneužíváním dětí,\n- **chráněné druhy** živočichů a rostlin (CITES) bez dokladů, zvířata z množíren, zvířata mladší 8 týdnů a jakékoli týrání zvířat,\n- **tabákové výrobky a alkohol** bez příslušného oprávnění, e-cigarety pro nezletilé,\n- **kradené věci** a věci, k nimž nemáte vlastnické právo,\n- **finanční produkty** – nebankovní půjčky bez licence ČNB, pyramidové hry, „rychlé zbohatnutí“,\n- **nebezpečné výrobky** stažené z trhu a výrobky, které nesplňují bezpečnostní požadavky.',
    'Automatická kontrola na portálu rozpozná nejčastější zakázané výrazy (např. zbraně, náboje, drogy, padělky, doklady, erotické služby). Takový inzerát nejdřív zkontroluje moderátor.',
    '## Pravidla pro inzerát',
    '- Jeden inzerát = jedna nabídka. Nevkládejte stejný inzerát opakovaně ani do více kategorií.\n- Název a popis musí pravdivě odpovídat nabízené věci. Uveďte skutečnou cenu (nebo „dohodou“); cena 1 Kč jako lákadlo není povolena.\n- Fotografie musí zobrazovat nabízenou věc a musíte k nim mít práva. Nepoužívejte cizí fotografie z internetu.\n- V textu ani na fotografiích neuvádějte odkazy na jiné inzertní servery, reklamu nebo kontaktní údaje třetích osob.\n- Zákaz diskriminace: inzeráty práce a bydlení nesmí znevýhodňovat podle pohlaví, věku, národnosti, víry či jiných chráněných znaků.\n- Nabídky práce musí uvádět skutečného zaměstnavatele nebo agenturu a nesmí vyžadovat poplatek od uchazeče.',
    '## Firmy a podnikatelé',
    'Kdo nabízí zboží nebo služby v rámci podnikání, musí mít v profilu označení firmy, obchodní firmu a IČO. Podnikatel odpovídá za splnění povinností vůči spotřebitelům (informace o ceně, právo na odstoupení od smlouvy uzavřené na dálku, záruka a reklamace). Viz [Informace pro spotřebitele](/stranka/spotrebitele).',
    '## Jak pravidla vymáháme',
    'Porušení řešíme zamítnutím nebo odstraněním inzerátu, omezením funkcí nebo zablokováním účtu. Vždy vám pošleme odůvodnění a můžete podat [námitku](/namitka). Inzerát, který porušuje pravidla, můžete nahlásit tlačítkem „Nahlásit inzerát“, nezákonný obsah také přes [formulář podle DSA](/nahlasit-obsah).',
  ),

  p('nahlasovani-obsahu', 'Nahlašování nezákonného obsahu', 'Jak oznámit nezákonný obsah na Dejinzerat.cz podle nařízení o digitálních službách (DSA), jak oznámení vyřizujeme a kontaktní místo.',
    DRAFT_NOTE,
    'Dejinzerat.cz je hostingová služba a on-line platforma podle nařízení (EU) 2022/2065 o digitálních službách (DSA). Každý – i bez účtu – nám může oznámit obsah, který považuje za nezákonný.',
    '## Jak podat oznámení',
    'Použijte formulář **[Nahlásit nezákonný obsah](/nahlasit-obsah)**. Aby bylo oznámení úplné (čl. 16 DSA), uveďte:',
    '1. dostatečně odůvodněné vysvětlení, proč je obsah podle vás nezákonný,\n2. přesnou adresu (URL) obsahu, například odkaz na inzerát nebo profil,\n3. své jméno a e-mail – neplatí u oznámení týkajících se sexuálního zneužívání dětí, která můžete podat anonymně,\n4. prohlášení, že oznámení podáváte v dobré víře a údaje jsou podle vašeho nejlepšího vědomí přesné a úplné.',
    'Po odeslání dostanete **číslo oznámení** a potvrzení o přijetí e-mailem. Pro běžné porušení pravidel (špatná kategorie, duplicitní inzerát) stačí tlačítko „Nahlásit“ u inzerátu.',
    '## Jak oznámení vyřizujeme',
    '- Oznámení posoudí člověk z týmu moderace včas, s péčí, nestranně a objektivně. Automatické nástroje používáme jen k třídění.\n- Pokud je obsah nezákonný nebo porušuje [Pravidla inzerování](/stranka/pravidla-inzerovani), znepřístupníme ho nebo odstraníme.\n- O rozhodnutí a jeho důvodech informujeme oznamovatele (pokud uvedl e-mail) i autora obsahu.\n- Autor obsahu může do 6 měsíců podat [námitku](/namitka) a obě strany se mohou obrátit na certifikovaný orgán mimosoudního řešení sporů nebo na soud.\n- Kdo opakovaně podává zjevně neopodstatněná oznámení, tomu můžeme vyřizování oznámení na přiměřenou dobu pozastavit (čl. 23 DSA).\n- Při podezření na trestný čin ohrožující život nebo bezpečnost osob informujeme Policii ČR.',
    '## Jednotné kontaktní místo (čl. 11 a 12 DSA)',
    '- **Pro orgány členských států, Evropskou komisi a Evropský sbor pro digitální služby:** {{dsa_email}}\n- **Pro uživatele:** {{email}}, formulář [Nahlásit nezákonný obsah](/nahlasit-obsah)\n- Komunikujeme v češtině, slovenštině a angličtině.\n- Provozovatel: {{provozovatel}}, IČO {{ico}}, {{sidlo}}.',
    '## Transparentnost',
    'Jednou ročně zveřejníme zprávu o moderování obsahu: počet oznámení podle druhu, přijatá opatření, počet námitek a jejich výsledek a průměrnou dobu vyřízení (čl. 15 a 24 DSA).',
  ),

  p('cookies', 'Zásady používání cookies', 'Jaké cookies a místní úložiště Dejinzerat.cz používá a jak je můžete spravovat.',
    DRAFT_NOTE,
    'Cookies jsou malé soubory, které web ukládá do vašeho prohlížeče. Podobně funguje i místní úložiště prohlížeče (localStorage).',
    '## Co používáme',
    '- **dej_session** (cookie, nezbytná) – udržuje vaše přihlášení. Je chráněná (HttpOnly, Secure) a platí do odhlášení, nejdéle 30 dní.\n- **dej_oauth, dej_oauth_apple** (cookies, nezbytné) – chrání přihlášení přes Google nebo Apple, platí 10 minut.\n- **Ochrana proti robotům** (Cloudflare Turnstile, nezbytná) – u registrace a formulářů, pokud je zapnutá.\n- **Místní úložiště (nezbytné a funkční)** – zvolený světlý/tmavý režim, rozepsaný inzerát, poslední hledání a inzeráty k porovnání. Zůstávají jen ve vašem prohlížeči a nikam je neodesíláme.',
    'Analytické ani reklamní cookies teď **nepoužíváme**. Pokud je v budoucnu zavedeme, vyžádáme si předem váš souhlas a tuto stránku aktualizujeme.',
    '## Jak cookies spravovat',
    'Cookies můžete smazat nebo zablokovat v nastavení prohlížeče. Bez nezbytné cookie dej_session se ale nepřihlásíte. Právní základ: nezbytné cookies a úložiště používáme bez souhlasu podle § 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích, protože bez nich služba nefunguje.',
    'Více o zpracování údajů v [Zásadách zpracování osobních údajů](/stranka/ochrana-udaju).',
  ),

  p('kontakt', 'Kontakt', 'Kontakt na provozovatele portálu Dejinzerat.cz, zákaznickou podporu a kontaktní místo podle DSA.',
    '## Provozovatel',
    '**{{provozovatel}}**\nIČO: {{ico}}\nSídlo: {{sidlo}}\n{{rejstrik}}',
    '## Zákaznická podpora',
    '- E-mail: {{email}}\n- Telefon: {{telefon}}\n- Odpovídáme v pracovní dny, obvykle do 24 hodin.',
    '## Nahlášení nezákonného obsahu',
    'Formulář [Nahlásit nezákonný obsah](/nahlasit-obsah) funguje i bez účtu. Kontaktní místo pro úřady (DSA): {{dsa_email}}. Více na stránce [Nahlašování nezákonného obsahu](/stranka/nahlasovani-obsahu).',
    '## Ochrana osobních údajů',
    'Žádosti podle GDPR posílejte na {{email}}. Podrobnosti v [Zásadách zpracování osobních údajů](/stranka/ochrana-udaju).',
  ),

  p('spotrebitele', 'Informace pro spotřebitele', 'Práva spotřebitelů při nákupu přes Dejinzerat.cz: nákup od podnikatele a od soukromé osoby, odstoupení od smlouvy, reklamace a mimosoudní řešení sporů.',
    DRAFT_NOTE,
    'Dejinzerat.cz zprostředkovává kontakt mezi prodávajícími a kupujícími. Kupní smlouvu uzavíráte přímo s prodávajícím – provozovatel portálu není její stranou.',
    '## Kupujete od podnikatele',
    'U inzerátu i v profilu uvidíte označení **„Prodávající je podnikatel“** s obchodní firmou a IČO. Při nákupu od podnikatele máte jako spotřebitel zejména tato práva:',
    '- odstoupit od smlouvy uzavřené na dálku do 14 dní od převzetí zboží (§ 1829 občanského zákoníku), s výjimkami podle § 1837,\n- uplatnit práva z vadného plnění (reklamaci) – u nového zboží do 24 měsíců, u použitého lze lhůtu zkrátit na 12 měsíců,\n- dostat před uzavřením smlouvy informace o ceně včetně daní, nákladech na dopravu a totožnosti podnikatele.',
    'Za splnění těchto povinností odpovídá podnikatel, ne provozovatel portálu.',
    '## Kupujete od soukromé osoby',
    'Pokud prodávající není podnikatel, **na smlouvu se nevztahují práva spotřebitele** (např. odstoupení od smlouvy do 14 dní). Platí obecná pravidla občanského zákoníku. Zboží si proto pokud možno prohlédněte osobně a řiďte se radami [Jak nakupovat bezpečně](/stranka/bezpecny-nakup).',
    '## Řazení a hodnocení',
    'Výsledky hledání řadíme podle relevance k hledanému výrazu, data vložení, ceny nebo vzdálenosti – podle toho, co si vyberete. Placené topování posouvá inzeráty na přední pozice a takové inzeráty jsou viditelně označené štítkem „Top“. Hodnocení prodejců mohou přidat jen uživatelé, kteří s prodejcem skutečně komunikovali o inzerátu.',
    '## Mimosoudní řešení sporů',
    'Spor s podnikatelem můžete řešit mimosoudně u České obchodní inspekce (www.coi.cz/informace-o-adr). Spory z placených služeb portálu můžete řešit i s námi na {{email}}. Kontakt na provozovatele najdete na stránce [Kontakt](/stranka/kontakt).',
  ),

  p('podminky-placenych-sluzeb', 'Podmínky placených služeb', 'Obchodní podmínky placených služeb Dejinzerat.cz: topování, zvýraznění, prémiové inzeráty a firemní balíčky, platby, odstoupení a reklamace.',
    DRAFT_NOTE,
    '## 1. Poskytovatel',
    'Placené služby poskytuje {{provozovatel}}, IČO {{ico}}, se sídlem {{sidlo}}, {{rejstrik}}, e-mail {{email}}, telefon {{telefon}}.',
    '## 2. Služby a ceny',
    'Nabízíme zejména topování, zvýraznění, posunutí inzerátu, prémiové inzeráty a firemní balíčky. Aktuální popis a ceny včetně DPH jsou v [ceníku](/cenik). Cena platí v okamžiku objednávky.',
    '## 3. Objednávka a platba',
    'Smlouva vzniká potvrzením objednávky a zaplacením. Platit lze přes platební bránu uvedenou při objednávce. Daňový doklad vám pošleme e-mailem. (Online platby spouštíme v další fázi provozu portálu.)',
    '## 4. Poskytnutí služby',
    'Služba se aktivuje ihned po připsání platby a trvá po dobu uvedenou v ceníku. Pokud inzerát během trvání služby odstraníte nebo ho odstraníme pro porušení pravidel, cena se nevrací.',
    '## 5. Odstoupení od smlouvy',
    'Jako spotřebitel můžete od smlouvy o digitální službě odstoupit do 14 dní od jejího uzavření. Objednávkou výslovně žádáte o poskytnutí služby ihned a berete na vědomí, že po jejím úplném poskytnutí právo na odstoupení zaniká (§ 1837 písm. a) občanského zákoníku). Při odstoupení během trvání služby vrátíme poměrnou část ceny.',
    '## 6. Reklamace',
    'Pokud služba nefungovala, jak měla (např. topování se nezobrazilo), napište nám do 30 dní na {{email}}. Reklamaci vyřídíme do 30 dní; uznanou reklamaci řešíme prodloužením služby nebo vrácením ceny.',
    '## 7. Mimosoudní řešení sporů',
    'Spotřebitel může spor řešit u České obchodní inspekce (www.coi.cz). Ostatní práva a povinnosti upravují [Podmínky používání](/stranka/podminky).',
  ),

  p('napoveda', 'Nápověda', 'Nejčastější otázky k Dejinzerat.cz: vložení inzerátu, úprava a prodloužení, topování, uložená hledání, zprávy a bezpečnost.',
    '## Jak vložím inzerát?',
    'Klikněte na **Přidat inzerát**, napište název, vyberte kategorii (podle názvu ji navrhneme), přidejte fotografie, cenu a lokalitu. Vložení je zdarma a zabere zhruba minutu. Inzerát musí odpovídat [Pravidlům inzerování](/stranka/pravidla-inzerovani).',
    '## Jak inzerát upravím, prodloužím nebo označím jako prodaný?',
    'V sekci **Můj účet → Moje inzeráty**. Inzerát je aktivní 30 dní, tři dny před koncem vám připomeneme jeho prodloužení.',
    '## Proč můj inzerát čeká na schválení?',
    'Automatická kontrola našla něco, co musí posoudit moderátor (např. výraz ze seznamu zakázaného zboží). Obvykle to netrvá déle než několik hodin. Pokud inzerát zamítneme, napíšeme proč a můžete podat [námitku](/namitka).',
    '## Co je topování?',
    'Placená služba, která inzerát posune na přední pozice. Přehled najdete v [ceníku](/cenik).',
    '## Jak funguje uložené hledání?',
    'Ve výsledcích hledání klikněte na **Uložit hledání**. Jakmile se objeví nový odpovídající inzerát, pošleme vám upozornění.',
    '## Jak nakupovat bezpečně?',
    'Neplaťte předem neznámým prodejcům, neposílejte údaje z karty a nepoužívejte odkazy z podezřelých zpráv. Více v [radách pro bezpečný nákup](/stranka/bezpecny-nakup).',
    '## Jak nahlásím podvod nebo nezákonný obsah?',
    'U inzerátu klikněte na **Nahlásit inzerát**. Nezákonný obsah můžete oznámit i bez účtu přes [formulář podle DSA](/nahlasit-obsah).',
    '## Jak zruším účet a stáhnu svá data?',
    'V **Nastavení účtu** najdete export všech údajů i zrušení účtu. Viz [Zásady zpracování osobních údajů](/stranka/ochrana-udaju).',
    '## Nenašli jste odpověď?',
    'Napište nám na {{email}}.',
  ),
];
