/**
 * Stahování feedů a fotek partnerů z internetu – bezpečně:
 * jen http/https, žádné adresy vnitřní sítě (ochrana před SSRF, i po přesměrování), limit velikosti a času.
 * Přihlašovací údaje v odkazu (https://jmeno:heslo@…) se pošlou jako HTTP Basic, ne v adrese.
 */
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export const FEED_MAX_BYTES = 50 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 15 * 1024 * 1024;

/** Soukromé, místní a rezervované adresy (IPv4 i IPv6), kam import nesmí. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return isPrivateAddress(mapped[1]);
    return s === '::' || s === '::1' || s.startsWith('fc') || s.startsWith('fd') || /^fe[89ab]/.test(s) || s.startsWith('ff') || s.startsWith('64:ff9b');
  }
  return true;
}

/** Ověří adresu feedu/fotky. Vrací URL bez přihlašovacích údajů a případnou hlavičku Authorization. */
export async function checkUrl(raw: string, allowPrivate = process.env.FEED_ALLOW_PRIVATE === '1'): Promise<{ url: URL; auth?: string }> {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { throw new Error('Neplatná adresa (musí začínat https:// nebo http://).'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Adresa musí začínat https:// nebo http://.');
  let auth: string | undefined;
  if (url.username || url.password) {
    auth = `Basic ${Buffer.from(`${decodeURIComponent(url.username)}:${decodeURIComponent(url.password)}`).toString('base64')}`;
    url.username = ''; url.password = '';
  }
  if (!allowPrivate) {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error('Adresa vede do vnitřní sítě.');
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => { throw new Error(`Server ${host} neexistuje.`); });
    if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new Error('Adresa vede do vnitřní sítě.');
  }
  return { url, auth };
}

export interface Fetched { buf: Buffer; contentType: string; url: string }

/** Stáhne soubor (nejvýše `maxBytes`, `timeoutMs`), přesměrování sleduje ručně a každé znovu ověří. */
export async function fetchLimited(raw: string, opts: { maxBytes: number; timeoutMs: number; accept?: string; fetchImpl?: typeof fetch }): Promise<Fetched> {
  const doFetch = opts.fetchImpl ?? fetch;
  const signal = AbortSignal.timeout(opts.timeoutMs);
  let target = raw;
  let auth: string | undefined;
  for (let hop = 0; hop < 5; hop++) {
    const checked = await checkUrl(target);
    auth = checked.auth ?? (hop === 0 ? undefined : auth);
    const r = await doFetch(checked.url, {
      redirect: 'manual', signal,
      headers: { 'user-agent': 'Dejinzerat-import/1.0 (+https://dejinzerat.cz)', accept: opts.accept ?? '*/*', ...(auth ? { authorization: auth } : {}) },
    }).catch((e: Error) => { throw new Error(e.name === 'TimeoutError' || e.name === 'AbortError' ? 'Server neodpověděl včas.' : `Server nejde kontaktovat (${e.message}).`); });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      const next = new URL(r.headers.get('location')!, checked.url);
      if (next.host !== checked.url.host) auth = undefined; // heslo neposíláme na jiný server
      target = next.toString();
      await r.body?.cancel().catch(() => undefined);
      continue;
    }
    if (r.status === 401 || r.status === 403) throw new Error(`Server odmítl přístup (HTTP ${r.status}) – je feed veřejný, nebo potřebuje heslo?`);
    if (!r.ok) throw new Error(`Server vrátil chybu HTTP ${r.status}.`);
    const len = Number(r.headers.get('content-length') ?? 0);
    if (len > opts.maxBytes) throw new Error(`Soubor je příliš velký (${Math.round(len / 1048576)} MB, nejvýše ${Math.round(opts.maxBytes / 1048576)} MB).`);
    const chunks: Buffer[] = [];
    let size = 0;
    if (r.body) {
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > opts.maxBytes) { await reader.cancel().catch(() => undefined); throw new Error(`Soubor je příliš velký (nejvýše ${Math.round(opts.maxBytes / 1048576)} MB).`); }
        chunks.push(Buffer.from(value));
      }
    }
    return { buf: Buffer.concat(chunks), contentType: r.headers.get('content-type') ?? '', url: checked.url.toString() };
  }
  throw new Error('Příliš mnoho přesměrování.');
}
