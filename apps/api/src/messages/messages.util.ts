import { config } from '../common/config';

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
