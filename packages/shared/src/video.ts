/**
 * Odkazy na video k inzerátu (YouTube, Vimeo).
 * Rozpozná běžné tvary odkazů a vrátí normalizovanou adresu a adresu přehrávače pro <iframe>.
 */
export interface ParsedVideo {
  provider: 'youtube' | 'vimeo';
  id: string;
  /** Normalizovaný odkaz, který ukládáme do databáze */
  url: string;
  /** Adresa přehrávače pro <iframe> */
  embed: string;
  /** Náhledový obrázek (jen YouTube) */
  thumb?: string;
}

export const VIDEO_URL_ERROR = 'Tento odkaz na video neumíme přehrát. Vložte odkaz na YouTube nebo Vimeo.';

const YT_ID = /^[\w-]{11}$/;
const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

function youtube(id: string): ParsedVideo {
  return { provider: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}`, embed: `https://www.youtube-nocookie.com/embed/${id}`, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
}
function vimeo(id: string, hash?: string): ParsedVideo {
  return { provider: 'vimeo', id, url: `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`, embed: `https://player.vimeo.com/video/${id}${hash ? `?h=${hash}` : ''}` };
}

export function parseVideoUrl(input: string | null | undefined): ParsedVideo | null {
  let raw = (input ?? '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be') {
    const id = parts[0];
    return id && YT_ID.test(id) ? youtube(id) : null;
  }
  if (YT_HOSTS.has(host)) {
    if (parts[0] === 'watch' || parts.length === 0) {
      const id = u.searchParams.get('v') ?? '';
      return YT_ID.test(id) ? youtube(id) : null;
    }
    if (['shorts', 'embed', 'live', 'v', 'e'].includes(parts[0])) {
      const id = parts[1] ?? '';
      return YT_ID.test(id) ? youtube(id) : null;
    }
    return null;
  }
  if (VIMEO_HOSTS.has(host)) {
    // player.vimeo.com/video/123?h=abc
    if (host === 'player.vimeo.com') {
      if (parts[0] !== 'video' || !/^\d+$/.test(parts[1] ?? '')) return null;
      const h = u.searchParams.get('h');
      return vimeo(parts[1], h && /^[\da-f]+$/i.test(h) ? h : undefined);
    }
    // vimeo.com/123, vimeo.com/123/abcdef (neveřejné), vimeo.com/channels/x/123, vimeo.com/groups/x/videos/123, vimeo.com/showcase/1/video/123
    const idx = parts.findIndex((p) => /^\d+$/.test(p));
    if (idx < 0) return null;
    const before = parts.slice(0, idx);
    const okPrefix = before.length === 0 || ['channels', 'groups', 'showcase', 'album'].includes(before[0]);
    if (!okPrefix) return null;
    if (before[0] === 'showcase' || before[0] === 'album') {
      // vimeo.com/showcase/1234 je seznam videí, ne video – video je až za /video/
      const vi = parts.indexOf('video');
      if (vi < 0 || !/^\d+$/.test(parts[vi + 1] ?? '')) return null;
      return vimeo(parts[vi + 1]);
    }
    const next = parts[idx + 1];
    return vimeo(parts[idx], before.length === 0 && next && /^[\da-f]{6,}$/i.test(next) ? next : undefined);
  }
  return null;
}
