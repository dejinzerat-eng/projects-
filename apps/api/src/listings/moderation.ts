/**
 * Automatická kontrola obsahu inzerátu a zpráv (pravidla). Vrací skóre 0–100 a důvody.
 * Fáze 2: doplnit AI klasifikaci (Claude) a detekci duplicitních fotek.
 *
 * JS `\b` zná jen ASCII písmena, takže slova končící diakritikou („zbraň“, „extáz“) se nikdy nenašla.
 * `w` nahradí `\b` hranicí slova, která počítá i česká písmena. Pozor: `\b` tedy patří jen vedle písmen
 * a číslic – před „+“ (telefonní předvolba) hranice slova nikdy neplatí.
 */
const w = (re: RegExp) => new RegExp(re.source.replace(/\\b/g, '(?:(?<![\\p{L}\\p{N}_])(?=[\\p{L}\\p{N}_])|(?<=[\\p{L}\\p{N}_])(?![\\p{L}\\p{N}_]))'), `${re.flags.replace('u', '')}u`);

interface Rule { re: RegExp; score: number; label: string }
const rule = (label: string, score: number, re: RegExp): Rule => ({ label, score, re: w(re) });

/** Skóre, od kterého jde inzerát ke schválení moderátorovi. */
export const REVIEW_SCORE = 50;
/** Vysoce rizikový obsah – účet se automaticky omezí (viz TrustService). */
export const HIGH_RISK_SCORE = 80;

// Zakázané výrazy jsou kmeny slov – na konci nemají hranici slova, aby se chytilo i „pistoli“, „marihuanu“.
// Skóre 80 = vysoké riziko (zbraně, drogy, doklady, sex. služby), 60 = jen ke kontrole (padělky, léky, půjčky).
const PROHIBITED: Rule[] = [
  rule('zbraně a střelivo', 80, /\b(zbra[nň]|pistol(?!n[ií]k|ov)|revolver|samopal|kalašnikov|ak-?47\b|glock|brokovnic|kulovnic|munic|st[řr]elivo|ostr[éý]\s+n[aá]boj|n[aá]boj[eů]?\s+(do|pro)\s+(pistol|zbra|revolver|pušk|brokovnic)|r[aá]ž[ei]\s+\d|ru[čc]n[ií]\s+gran[aá]t|výbušnin|trhavin|semtex|tlumi[čc]\s+(hluku\s+)?(na|pro)\s+(zbra|pistol|pušk))/iu),
  rule('drogy', 80, /\b(drog[ayu]\s+(na\s+prodej|skladem|dovezu|dod[aá]m|ihned|levn)|(prod[aá]m|nab[ií]z[ií]m|dod[aá]m|sezenu|se[žz]enu|dovezu)\s+(\p{L}+\s+){0,2}drog[ayu]?\b|marihuan|kokain|pervitin|heroin(?![ae])|ha[sš]i[sš]|extáz|mdma\b|lsd\b|ketamin|fentanyl|lysohl[aá]vk|crystal\s?meth|thc\s?(olej|vape|n[aá]pl[nň]|gum[ií]k|bonbon|kv[ěe]t))/iu),
  rule('padělané doklady', 80, /\b(((prod[aá]m|nab[ií]z[ií]m|za[řr][ií]d[ií]m|vyrob[ií]m)\s+((nov|česk|slovensk|evropsk|prav|origin[aá]ln|registrovan|cestovn|platn|fale[šs]n|pad[ěe]lan)\p{L}*\s+|v[aá]m\s+|ti\s+){0,2}(ob[čc]ansk\p{L}*\s+pr[ůu]kaz|[řr]idi[čc]sk\p{L}*\s+pr[ůu]kaz|[řr]idi[čc][aá]k[yu]?\b|pas[yu]?\b|ob[čc]ank[uy]\b|doklady\s+(toto[žz]nosti|na\s+(jin[ée]|cizí|libovoln))))|(za[řr][ií]d[ií]m|vyrob[ií]m)\s+(v[aá]m\s+|ti\s+)?(\p{L}+\s+)?doklady\b|([řr]idi[čc][aá]k\p{L}*|doklady|pas|ob[čc]ansk\p{L}*\s+pr[ůu]kaz)\s+na\s+prodej|[řr]idi[čc][aá]k\p{L}*\s+bez\s+(zkou[šs]ek|autoškoly)|(fale[šs]n|pad[ěe]lan)\p{L}*\s+(doklad|pas|pr[ůu]kaz|[řr]idi[čc][aá]k|bankovk|pen[ií]z|eur|dolar))/iu),
  rule('sexuální služby', 80, /\b(eskort\p{L}*\s+(služb|agentur|sleč|d[ií]v[kč]|společ)|(?<!ford\s{1,3})escort\s+(služb|agentur|sleč|d[ií]v[kč]|girl|servis|service)|sex\s?služb|sexu[aá]ln\p{L}*\s+služb|erotick[éá]\s+(služb|mas[aá]ž)|prostituc|mas[aá][žz]\p{L}*[^\n]{0,40}happy\s?end)/iu),
  rule('padělky značkového zboží', 60, /\b(pad[ěe]lek|pad[ěe]lky|replik\p{L}*\s+(zna[čc]k|rolex|louis|lv\b|gucci|chanel|prada|herm[eè]s|dior|nike|adidas|moncler|canada\s+goose|balenciaga)|fake\s+(rolex|nike|gucci|louis|adidas)|kopie\s+(zna[čc]k|rolex|louis|gucci|chanel|hodinek\s+rolex)|1\s?:\s?1\s+(kopie|replik)|aaa\s+kvalit)/iu),
  rule('léčiva a anabolika', 60, /\b(l[ée]k\p{L}*\s+na\s+p[řr]edpis|anaboli[kc]|steroid[yůa]|xanax|rivotril|neurol\b|tramal|oxykodon|oxycontin|morfin|metadon|subutex)/iu),
  rule('kradené zboží a chráněné druhy', 60, /\b(kraden\p{L}*\s+(zbo[žz][ií]|v[ěe]c|telefon|mobil|kol[oa]|aut[oa]|notebook)|bez\s+dokladu\s+o\s+p[ůu]vodu|slonovin)/iu),
  rule('rizikové půjčky', 60, /\b(p[ůu]j[čc]k\p{L}*\s+(i\s+)?bez\s+(registr|dolo[žz]en|ru[čc]itel)|nebankovn\p{L}*\s+p[ůu]j[čc]k|p[ůu]j[čc]k\p{L}*\s+ihned\s+na\s+ruku)/iu),
];

/** Nevinné spojení se slovem ze seznamu (nářadí, hračky) – před kontrolou zakázaného zboží se z textu vypustí. */
const BENIGN = [
  /\b(tavn|st[řr][ií]kac|lakovac|p[aá]jec|horkovzdu[šs]n|vodn|d[ěe]tsk|tlakov|myc|h[řr]eb[ií]kovac|sponkovac|n[ýy]tovac|silikonov|vzduchov|mas[aá][žz]n|p[ěe]nov|kartu[šs]ov|ofukovac|foukac|plastov|kapaln)\p{L}*\s+(pistol|zbra[nň])\p{L}*/iu,
  /\bpistol\p{L}*\s+(na|pro)\s+(silikon|lepidl|tavn|barv|lak|vod|myt|kartu[šs]|h[řr]eb[ií]k|sponk|n[ýy]t|p[ěe]n|maz|vzduch|ofuk|fouk|tmel|mont[aá][žz]n|pneu|hu[šs]t[ěe]n)\p{L}*/iu,
  /\bpistolov\p{L}*\s+(vrta[čc]k|[šs]roubov[aá]k|uchop|rukoje)\p{L}*/iu,
  /\b(nerf|airsoft\p{L}*|hra[čc]k\p{L}*|lego|playmobil|paintball\p{L}*|kuli[čc]kov\p{L}*)\s+(\p{L}+\s+)?(pistol|zbra[nň]|revolver|pu[šs]k|samopal|kala[šs]nikov|glock)\p{L}*(\s+(glock|colt|beretta|walther|ak-?47|m4|kala[šs]nikov)\p{L}*)?/iu,
  // Příslušenství (trezor na zbraně, pouzdro na pistoli, čisticí sada) – samo o sobě zakázané není
  /\b(trezor|sk[řr][ií][ňn]|pouzd[rř]|dr[žz][aá]k|kuf[rř]|ta[šs]k|stojan|[čc]ist[ií]c|sad[ay]|obal|vitr[ií]n|ter[čc]|[řr]emen|popruh)\p{L}*\s+(na|pro)\s+(\p{L}+\s+)?(zbra|pistol|pu[šs]k|brokovnic|revolver)\p{L}*/iu,
].map(w);

// Znaky podvodu (Western Union, kurýr „po zaplacení“, prodejce v zahraničí, kontakt mimo portál, platební odkazy, údaje z karty)
const SCAM: Rule[] = [
  rule('neobvyklý způsob platby', 50, /\b(western\s?union|moneygram|ria\s+money|paysafecard|d[aá]rkov\p{L}*\s+kart\p{L}*\s+(google|apple|itunes|steam|amazon)|(bitcoin\p{L}*|kryptom[ěe]n\p{L}*|usdt)\s+(platb|zaplat|plat[ií]m)|platb\p{L}*\s+(v\s+|p[řr]es\s+)?(bitcoin|kryptu|kryptom[ěe]n))/iu),
  rule('platba předem do zahraničí', 50, /\b(platb\p{L}*\s+p[řr]edem\s+na\s+(ú[čc]et\s+v\s+zahrani[čc][ií]|zahrani[čc]n\p{L}*\s+ú[čc]et)|na\s+zahrani[čc]n\p{L}*\s+ú[čc]et|z[aá]loh\p{L}*\s+na\s+(dopravu|p[řr]epravu|clo|poji[šs]t[ěe]n[ií]\s+z[aá]silky)|zapla\p{L}*\s+(clo|celn[ií]\s+poplat))/iu),
  rule('doprava až po zaplacení', 50, /\b(po[šs]l\p{L}*\s+(to\s+|v[aá]m\s+)?(kur[ýy]r\p{L}*|dpd|ups|dhl|fedex)\s+(a[žz]\s+)?po\s+zaplacen[ií]|kur[ýy]r\p{L}*\s+(si\s+)?(vyzvedne|p[řr]evezme)\s+(\p{L}+\s+){0,2}(a\s+)?(pen[ií]z|platb))/iu),
  rule('prodejce v zahraničí', 50, /\b(jsem\s+(mom[eě]ntáln[ěe]\s+|te[ďd]\s+|nyn[ií]\s+|pr[aá]v[ěe]\s+|bohu[žz]el\s+)?(v\s+zahrani[čc][ií]|na\s+(vojensk\p{L}*\s+)?misi|na\s+ropn\p{L}*\s+plo[šs]in|na\s+lodi|v\s+(anglii|n[ěe]mecku|brit[aá]nii|nig[ée]rii|irsku|skotsku|usa|americe|kanad[ěe]))|pracuj\p{L}*\s+(v\s+zahrani[čc][ií]|na\s+ropn|na\s+lodi|na\s+misi))/iu),
  rule('kontakt mimo portál na zahraniční číslo', 50, /\b(whatsapp|telegram|viber|signal)\b[^\n]{0,60}?\+(44|23[3-7]|1)(?=[\s\d(-])/iu),
  rule('komunikace jen mimo portál', 50, /\b(komunik\p{L}*|kontakt\p{L}*|pi[šs]\p{L}*|napi[šs]\p{L}*)\s+(\p{L}+\s+){0,3}(pouze|jen|v[ýy]hradn[ěe])\s+(p[řr]es|na)\s+(whatsapp|telegram|viber|signal)/iu),
  rule('platební odkaz nebo údaje z karty', 50, /\b(klikn[ěe]te\s+na\s+(tento\s+|n[ií][žz]e\s+uveden\p{L}*\s+)?odkaz|(platebn|zabezpe[čc]en|bezpe[čc]n)\p{L}*\s+odkaz|odkaz\p{L}*\s+(k|pro|na)\s+(platb|p[řr]ijet[ií]|zaplacen|p[řr]evzet[ií]\s+pen[ěe]z|vyplacen)|pro\s+p[řr]ijet[ií]\s+(platby|pen[ěe]z)|zadejte\s+(\p{L}+\s+){0,2}(kart|cvv|pin)|(č[ií]slo|ú[dď]aje|[čc][ií]sla)\s+(z\s+)?(va[šs][ií]\s+|sv[ée]\s+)?(platebn[ií]\s+)?karty|cvv\b|cvc\b|k[óo]d\s+z\s+sms|ov[ěe][řr]ovac[ií]\s+k[óo]d|(z[aá]silkovn|bal[ií]kovn|dpd|ppl|po[šs]t)\p{L}*\s+(v[aá]m\s+)?(po[šs]le|za[šs]le|p[řr]ijde)\s+(\p{L}+\s+){0,2}odkaz)/iu),
  rule('nereálný výdělek', 50, /\b(rychl\p{L}*\s+v[ýy]d[ěe]lek|garantovan\p{L}*\s+(v[ýy]nos|zisk)|zbohatn[eě]te|vyd[ěe]lejte\s+(si\s+)?(a[žz]\s+)?\d)/iu),
];

const PROHIBITED_REASON = 'Možný zakázaný obsah';
const SCAM_REASON = 'Znaky podvodného inzerátu';

function stripBenign(text: string) { return BENIGN.reduce((t, re) => t.replace(new RegExp(re.source, `${re.flags}g`), ' '), text); }

/** Skóre a důvody včetně podrobných štítků pro moderátory (např. „zbraně a střelivo“). */
export function assessListingDetailed(input: { title: string; description: string; price?: number | null; categorySlug?: string }) {
  const text = `${input.title}\n${input.description}`;
  const reasons: string[] = [];
  const labels: string[] = [];
  let score = 0;
  const clean = stripBenign(text);
  const prohibited = PROHIBITED.filter((r) => r.re.test(clean));
  if (prohibited.length) { score += Math.max(...prohibited.map((r) => r.score)); reasons.push(PROHIBITED_REASON); labels.push(...prohibited.map((r) => r.label)); }
  const scam = SCAM.filter((r) => r.re.test(text));
  if (scam.length) { score += 50; reasons.push(SCAM_REASON); labels.push(...scam.map((r) => r.label)); }
  const links = (text.match(/https?:\/\//g) ?? []).length;
  if (links > 2) { score += 20; reasons.push('Mnoho odkazů'); }
  const upper = input.title.replace(/[^A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, '').length;
  if (input.title.length > 10 && upper / input.title.length > 0.7) { score += 10; reasons.push('Nadpis velkými písmeny'); }
  if (/(.)\1{6,}/.test(text)) { score += 10; reasons.push('Opakované znaky'); }
  if (input.price != null && input.price > 0 && input.price < 100 && ['auto-moto', 'reality'].includes(input.categorySlug ?? '')) { score += 30; reasons.push('Podezřele nízká cena'); }
  return { score: Math.min(100, score), reasons, labels };
}

export function assessListing(input: { title: string; description: string; price?: number | null; categorySlug?: string }) {
  const { score, reasons } = assessListingDetailed(input);
  return { score, reasons };
}

/** Riziko zprávy: znaky podvodu a zakázané zboží (pro varování příjemce a automatické omezení odesílatele). */
export function assessMessageRisk(body: string) {
  const scam = SCAM.filter((r) => r.re.test(body));
  const clean = stripBenign(body);
  const prohibited = PROHIBITED.filter((r) => r.re.test(clean));
  const score = Math.min(100, (scam.length ? 50 : 0) + (prohibited.length ? Math.max(...prohibited.map((r) => r.score)) : 0));
  return { score, scam: scam.length > 0, labels: [...scam, ...prohibited].map((r) => r.label) };
}

export function assessMessage(body: string) {
  return SCAM.some((r) => r.re.test(body)) ? 'Tato zpráva může být podvod. Nikdy neplaťte předem mimo ověřené kanály a neposílejte údaje z karty.' : null;
}
