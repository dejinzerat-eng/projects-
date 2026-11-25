/**
 * Kontrola zpráv na podezřelé odkazy a pokusy o podvod.
 * Výsledek se zobrazuje jen příjemci jako varování; zpráva se kvůli tomu nezahazuje.
 * Odkazy v textu se nikdy neprolinkovávají (zobrazují se jako prostý text).
 */

export type LinkLevel = 'danger' | 'warn';
export interface MessageWarning { level: LinkLevel; title: string; reasons: string[]; advice: string }

const SHORTENERS = new Set([
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.ly', 'is.gd', 'cutt.ly', 'goo.gl', 'ow.ly', 't.co', 'rebrand.ly', 'shorturl.at', 'tiny.cc',
  's.id', 'rb.gy', 'bit.do', 'buff.ly', 'v.gd', 'qr.co', 'shorte.st', 'adf.ly', 'tiny.one', 'tinu.be', 'urlz.fr', 'lnkd.in', 'shrtco.de', 'gg.gg',
]);

/** Oficiální domény dopravců, bank a bazarů – odkaz na ně nevaruje. Napodobeniny (zasilkovna-platba.cz) ano. */
const OFFICIAL = new Set([
  'zasilkovna.cz', 'packeta.com', 'packeta.cz', 'ppl.cz', 'dpd.cz', 'dpd.com', 'ceskaposta.cz', 'postaonline.cz', 'balikovna.cz', 'gls-group.eu', 'gls-czech.com',
  'wedo.cz', 'bazos.cz', 'sbazar.cz', 'vinted.cz', 'paypal.com', 'revolut.com', 'csob.cz', 'kb.cz', 'fio.cz', 'airbank.cz', 'moneta.cz', 'rb.cz',
  'unicreditbank.cz', 'csas.cz', 'mbank.cz', 'creditas.cz', 'equabank.cz', 'dejinzerat.cz',
]);
/** Běžné bezpečné stránky – bez varování */
const ALLOW = new Set(['youtube.com', 'youtu.be', 'mapy.cz', 'mapy.com', 'google.com', 'vimeo.com']);

/** Značky, které podvodníci napodobují. Krátké zkratky (ppl, dpd, kb…) se hledají jen jako samostatné části domény. */
const BRAND_STEMS = ['zasilkovna', 'packeta', 'balikovna', 'ceskaposta', 'postaonline', 'bazos', 'sbazar', 'vinted', 'paypal', 'revolut', 'airbank', 'moneta', 'csob', 'raiffeisen', 'unicredit', 'sporitelna', 'creditas', 'equabank', 'dejinzerat'];
const BRAND_TOKENS = new Set(['ppl', 'dpd', 'gls', 'posta', 'kb', 'rb', 'fio', 'csas', 'mbank', 'wedo', 'george', 'komercni', 'banka', 'bank']);
const PAY_WORDS = /(platb|zaplat|pay|overen|overit|verif|karta|karty|card|login|prihlas|doruc|delivery|refund|vraceni|secure|bezpecn)/;

const TLDS = 'cz|sk|com|net|org|eu|info|biz|xyz|top|online|site|shop|store|link|club|io|me|app|ly|gd|co|ru|ua|de|pl|at|uk|hu|live|pro|vip|icu|cc|tk|ml|ga|cf|gq|page|dev|website|space|fun|click|today|support|help|delivery|express|services|world|tech|cloud|best|buzz|cam|monster|rest|bar|work|life|lol|sbs|cfd|bond|men|ws|su|by|kz|cn|tv|in|us|ca|nl|be|fr|it|es|ch';
// Odkaz se schématem nebo www. (libovolná TLD), holá doména jen se známou TLD, IPv4 adresa
const URL_RE = new RegExp(
  String.raw`(?:https?:\/\/|www\.)[^\s<>"']+` +
  String.raw`|(?<![\p{L}\p{N}@.-])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:${TLDS}|xn--[a-z0-9-]+)(?![\p{L}\p{N}-])(?:\/[^\s<>"']*)?` +
  String.raw`|(?<![\p{N}.])\d{1,3}(?:\.\d{1,3}){3}(?![\p{N}.]|\.\d)(?::\d+)?(?:\/[^\s<>"']*)?`,
  'giu',
);
const MESSENGER_RE = /(?<![\p{L}\p{N}])(whats\s?app|wa\.me|telegram|t\.me|signal|viber)(?![\p{L}\p{N}])/iu;
// +44…, 0044…; čísla +420/+421 jsou v pořádku
const INTL_PHONE_RE = /(?<![\p{L}\p{N}+])(?:\+|00)\s?(\d[\d \-.]{6,16}\d)/gu;
// Obraty typické pro podvody (Unicode hranice slov, aby fungovala diakritika)
const SCAM_PHRASES = [
  /western\s?union|moneygram/iu,
  /(?<![\p{L}])(bitcoin|kryptoměn|usdt)/iu,
  /platb[aěu]\s+předem|zaplaťte\s+předem|záloh[ua]\s+předem/iu,
  /(?<![\p{L}])(jsem\s+v\s+zahraničí|jsem\s+na\s+misi|pracuji\s+v\s+zahraničí)/iu,
  /pošlu\s+(to\s+)?kurýrem\s+po\s+zaplacení/iu,
  /(klikněte|klikni)\s+na\s+(odkaz|link)/iu,
  /(číslo|údaje)\s+(z\s+)?(platební\s+)?karty|cvv|cvc\s?kód|ověřovací\s+kód\s+z\s+sms/iu,
  /bezpečn[aáé]\s+platb[aya]|platb[au]\s+přes\s+(zásilkovnu|ppl|dpd|poštu)|převzetí\s+platby/iu,
];

export interface ParsedLink { raw: string; host: string; path: string }

export function extractLinks(text: string): ParsedLink[] {
  const out: ParsedLink[] = [];
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0].replace(/[),.;:!?»“”'"]+$/u, '');
    const noScheme = raw.replace(/^https?:\/\//i, '');
    const cut = noScheme.search(/[/?#]/);
    let host = (cut === -1 ? noScheme : noScheme.slice(0, cut)).toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '');
    if (host.includes('@')) host = host.slice(host.lastIndexOf('@') + 1); // https://zasilkovna.cz@evil.com
    if (!host) continue;
    try { host = new URL(`http://${host}`).hostname; } catch { /* necháme, jak je */ }
    out.push({ raw, host, path: cut === -1 ? '' : noScheme.slice(cut).toLowerCase() });
  }
  return out;
}

/** Registrovaná doména (poslední dvě části). Pro účely varování stačí. */
const registered = (host: string) => host.split('.').slice(-2).join('.');
const isIp = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function assessLink(link: ParsedLink, ownHosts: string[] = []): { level: LinkLevel | null; reason?: string } {
  const host = link.host;
  const reg = registered(host);
  const own = ownHosts.some((h) => host === h || host.endsWith(`.${h}`));
  if (own || ALLOW.has(reg) || ALLOW.has(host)) return { level: null };
  if (isIp(host)) return { level: 'danger', reason: `Odkaz vede na IP adresu (${host}) místo běžné stránky.` };
  if (host.split('.').some((p) => p.startsWith('xn--')) || /[^\x00-\x7f]/.test(host)) return { level: 'danger', reason: `Adresa ${host} obsahuje neobvyklé znaky a může napodobovat známou stránku.` };
  if (SHORTENERS.has(host) || SHORTENERS.has(reg)) return { level: 'danger', reason: `Zkrácený odkaz (${host}) skrývá, kam ve skutečnosti vede.` };
  if (OFFICIAL.has(reg) || OFFICIAL.has(host)) return { level: null };
  const flat = strip(host).replace(/[^a-z0-9.-]/g, '');
  const tokens = flat.split(/[.-]/);
  const joined = flat.replace(/[.-]/g, '');
  if (BRAND_STEMS.some((b) => joined.includes(b)) || tokens.some((t) => BRAND_TOKENS.has(t)) || /ceska-?posta|cesk[ae]-?sporitelna|komercni-?banka/.test(flat)) {
    return { level: 'danger', reason: `Stránka ${host} se tváří jako dopravce, banka nebo bazar, ale není jejich oficiální adresou.` };
  }
  if (PAY_WORDS.test(strip(link.path)) || PAY_WORDS.test(joined)) return { level: 'danger', reason: `Odkaz ${host} vede na platbu nebo „ověření“ mimo Dejinzerat.cz.` };
  return { level: 'warn', reason: `Zpráva obsahuje odkaz na stránku mimo Dejinzerat.cz (${host}).` };
}

export function foreignPhones(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(INTL_PHONE_RE)) {
    const digits = m[1].replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) continue;
    if (/^42[01]/.test(digits)) continue;
    out.push(`+${digits}`);
  }
  return out;
}

const ADVICE = 'Neklikejte na odkazy, nezadávejte údaje z platební karty ani přihlášení do banky a neplaťte předem. Dejinzerat.cz nikdy nechce platbu přes odkaz ve zprávě.';

/** Vyhodnotí zprávu. `ownHosts` = naše domény (web a úložiště fotek), které nevarují. */
export function assessMessageSafety(body: string, ownHosts: string[] = []): MessageWarning | null {
  if (!body) return null;
  const reasons: string[] = [];
  let level: LinkLevel | null = null;
  const bump = (l: LinkLevel) => { if (l === 'danger' || !level) level = l; };
  const seen = new Set<string>();
  for (const link of extractLinks(body)) {
    if (seen.has(link.host)) continue;
    seen.add(link.host);
    const r = assessLink(link, ownHosts);
    if (r.level) { bump(r.level); reasons.push(r.reason!); }
  }
  if (MESSENGER_RE.test(body)) { bump('warn'); reasons.push('Pisatel chce komunikaci převést na WhatsApp, Telegram nebo jinou aplikaci, kde ho už nechráníme.'); }
  const phones = foreignPhones(body);
  if (phones.length) { bump('danger'); reasons.push(`Zpráva obsahuje zahraniční telefonní číslo (${phones[0]}).`); }
  if (SCAM_PHRASES.some((r) => r.test(body))) { bump('danger'); reasons.push('Text obsahuje obraty typické pro podvody (platba předem, kurýr, údaje z karty).'); }
  if (!level) return null;
  return {
    level, reasons: reasons.slice(0, 4), advice: ADVICE,
    title: level === 'danger' ? 'Pozor, tato zpráva může být podvod' : 'Opatrně s odkazy a přesunem mimo Dejinzerat.cz',
  };
}

/** Obsahuje text něco, co vypadá jako odkaz? (pro jména v e-mailech a náhledy) */
export const looksLikeLink = (s: string) => extractLinks(s).length > 0;

/** Pro e-mail/notifikaci: zbaví text řídicích znaků a zkrátí ho. */
export function cleanPreview(s: string, max = 140) {
  const t = s.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
