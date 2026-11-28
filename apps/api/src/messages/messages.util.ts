import { config } from '../common/config';
import { cleanPreview, escapeHtml, looksLikeLink } from './link-check';

/** Klíč přímé konverzace (bez inzerátu) – stejný pro obě pořadí účastníků. */
export const directKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export interface MediaEnv { s3PublicUrl: string; blob: boolean }
export const mediaEnv = (): MediaEnv => ({ s3PublicUrl: config.s3.bucket ? config.s3.publicUrl : '', blob: !!process.env.BLOB_READ_WRITE_TOKEN });

/**
 * Patří adresa obrázku do našeho úložiště zpráv? (druhá pojistka vedle záznamu MessageAttachment)
 * Lokální disk (/uploads/messages/), veřejná URL S3/R2, nebo Vercel Blob.
 */
export function isOwnMediaUrl(url: string, env: MediaEnv = mediaEnv()) {
  if (url.includes('..') || /[\s"'<>\\]/.test(url)) return false;
  if (/^\/uploads\/messages\/[\w/-]+\.webp$/.test(url)) return true;
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:' || u.username || u.password) return false;
  if (env.s3PublicUrl) {
    const base = new URL(env.s3PublicUrl.replace(/\/$/, '') + '/');
    if (u.origin === base.origin && u.pathname.startsWith(`${base.pathname}messages/`)) return true;
  }
  if (env.blob && /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(u.hostname) && u.pathname.startsWith('/messages/')) return true;
  return false;
}

/** Naše domény, na které odkazy ve zprávách nevarují (web, API a úložiště fotek). */
export function ownHosts(): string[] {
  const hosts = new Set(['dejinzerat.cz']);
  for (const o of [config.webOrigin, config.publicApiUrl, config.s3.publicUrl]) {
    try { if (o) hosts.add(new URL(o).hostname.replace(/^www\./, '')); } catch { /* */ }
  }
  return [...hosts];
}

/** Na Vercelu je disk jen pro čtení – fotky ve zprávách se zapnou samy po nastavení BLOB_READ_WRITE_TOKEN nebo S3_*. */
export const photosEnabled = () => !process.env.VERCEL || !!process.env.BLOB_READ_WRITE_TOKEN || !!config.s3.bucket;

/** Jméno do e-mailu a notifikace: bez řídicích znaků, a když vypadá jako odkaz, raději ho nezobrazíme. */
export const safeName = (name: string) => (looksLikeLink(name) ? 'Uživatel' : cleanPreview(name, 60) || 'Uživatel');

/**
 * E-mail o nové zprávě. Veškerý text od uživatelů (jméno, název inzerátu, text zprávy) je escapovaný,
 * a když zpráva obsahuje odkaz nebo kontakt (`risky`), text se do e-mailu vůbec nedává.
 */
export function messageEmail(p: { name: string; listingTitle: string | null; body: string; risky: boolean; hasImage: boolean; url: string; settingsUrl: string }) {
  const name = safeName(p.name);
  const title = p.listingTitle && !looksLikeLink(p.listingTitle) ? cleanPreview(p.listingTitle, 80) : null;
  const subject = title ? `Nová zpráva k inzerátu „${title}“` : `Nová zpráva od ${name}`;
  const quote = p.body && !p.risky
    ? `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #ddd;color:#333">${escapeHtml(cleanPreview(p.body, 500))}</blockquote>`
    : `<p>${p.hasImage && !p.body ? 'Poslal(a) vám fotografii.' : 'Zprávu si přečtěte přímo na DEJINZERAT.cz.'}</p>`;
  const html = `<p><strong>${escapeHtml(name)}</strong> vám napsal(a)${title ? ` k inzerátu „${escapeHtml(title)}“` : ''}:</p>${quote}`
    + `<p><a href="${escapeHtml(p.url)}">Otevřít konverzaci</a></p>`
    + `<p style="font-size:12px;color:#666">Nikdy neplaťte předem a nezadávejte údaje z karty na odkazech ze zpráv. E-maily o nových zprávách vypnete v <a href="${escapeHtml(p.settingsUrl)}">Zprávách</a>.</p>`;
  return { subject, html };
}
