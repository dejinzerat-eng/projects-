import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { del as blobDel, put as blobPut } from '@vercel/blob';
import { Injectable, Logger } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join, resolve, sep } from 'path';
import { config } from '../common/config';

export interface StorageEnv { blob: boolean; s3PublicUrl: string }
export type StorageTarget = { kind: 'blob'; url: string } | { kind: 's3' | 'local'; key: string };

const SAFE_KEY = /^[\w-]+(?:\/[\w.-]+)*$/;
const safeKey = (k: string) => (SAFE_KEY.test(k) && !k.split('/').some((p) => p === '..' || p === '.') ? k : null);

/**
 * Kde soubor s danou URL leží – jen pokud je v našem úložišti (stejné pořadí jako `put`: Vercel Blob, S3, lokální disk).
 * Cizí URL (např. fotka z Google účtu) vrátí null – takový soubor nikdy nemažeme.
 */
export function storageTarget(url: string | null | undefined, env: StorageEnv): StorageTarget | null {
  if (!url || /[\s"'<>\\]/.test(url)) return null;
  if (url.startsWith('/uploads/')) { const key = safeKey(url.slice('/uploads/'.length)); return key ? { kind: 'local', key } : null; }
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash) return null;
  if (env.blob && /^[a-z0-9]+\.public\.blob\.vercel-storage\.com$/.test(u.hostname)) return safeKey(u.pathname.slice(1)) ? { kind: 'blob', url: u.href } : null;
  if (env.s3PublicUrl) {
    let base: URL;
    try { base = new URL(env.s3PublicUrl.replace(/\/$/, '') + '/'); } catch { return null; }
    if (u.origin === base.origin && u.pathname.startsWith(base.pathname)) {
      let key: string | null;
      try { key = safeKey(decodeURIComponent(u.pathname.slice(base.pathname.length))); } catch { return null; }
      return key ? { kind: 's3', key } : null;
    }
  }
  return null;
}

/** Úložiště souborů: S3 kompatibilní (AWS, Cloudflare R2, MinIO), nebo lokální disk pro vývoj. */
@Injectable()
export class StorageService {
  private log = new Logger('Storage');
  private s3?: S3Client;
  readonly localDir = join(process.cwd(), 'uploads');

  constructor() {
    if (config.s3.bucket) {
      this.s3 = new S3Client({ region: config.s3.region, endpoint: config.s3.endpoint, forcePathStyle: !!config.s3.endpoint, credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey } });
      this.log.log(`S3 úložiště: ${config.s3.bucket}`);
    } else if (process.env.BLOB_READ_WRITE_TOKEN) this.log.log('Úložiště: Vercel Blob');
    else this.log.log(`Lokální úložiště: ${this.localDir}`);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const r = await blobPut(key, body, { access: 'public', contentType, addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 31536000 });
      return r.url;
    }
    if (this.s3) {
      await this.s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: 'public, max-age=31536000, immutable' }));
      return `${config.s3.publicUrl.replace(/\/$/, '')}/${key}`;
    }
    const path = join(this.localDir, key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, body);
    return `/uploads/${key}`;
  }

  /** Smaže soubor podle jeho veřejné URL. Soubory mimo naše úložiště přeskočí (false). Chybějící soubor není chyba. */
  async delete(url: string | null | undefined): Promise<boolean> {
    const t = storageTarget(url, { blob: !!process.env.BLOB_READ_WRITE_TOKEN, s3PublicUrl: this.s3 ? config.s3.publicUrl : '' });
    if (!t) return false;
    if (t.kind === 'blob') { await blobDel(t.url); return true; }
    if (t.kind === 's3') { await this.s3!.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: t.key })); return true; }
    const root = resolve(this.localDir);
    const path = resolve(root, t.key);
    if (!path.startsWith(root + sep)) return false;
    try { await unlink(path); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    return true;
  }

  /** Smaže více souborů; chyby jen zaloguje (mazání souborů nikdy neblokuje hlavní operaci). Vrací počet smazaných. */
  async deleteMany(urls: (string | null | undefined)[]): Promise<number> {
    const list = [...new Set(urls.filter((u): u is string => !!u))];
    let n = 0;
    for (let i = 0; i < list.length; i += 10) {
      const done = await Promise.all(list.slice(i, i + 10).map((url) => this.delete(url).catch((e) => { this.log.warn(`Soubor ${url} se nepodařilo smazat: ${(e as Error).message}`); return false; })));
      n += done.filter(Boolean).length;
    }
    return n;
  }
}
