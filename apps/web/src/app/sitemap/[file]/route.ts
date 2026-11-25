import { api } from '@/lib/api';
import { meta, staticUrls, urlset } from '@/lib/sitemap';

/** Jednotlivé soubory sitemapy: static.xml, inzeraty-N.xml, profily-N.xml */
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (file === 'static.xml') {
    try { return urlset(staticUrls(await meta())); } catch { return urlset([{ loc: '/', changefreq: 'hourly', priority: 1 }]); }
  }
  const m = file.match(/^(inzeraty|profily)-(\d{1,4})\.xml$/);
  if (!m) return new Response('Not found', { status: 404 });
  const chunk = Number(m[2]);
  if (m[1] === 'inzeraty') {
    const rows = await api<{ id: string; slug: string; updatedAt: string }[]>(`/seo/sitemap/listings?chunk=${chunk}`, { revalidate: 3600, auth: false }).catch(() => []);
    return urlset(rows.map((l) => ({ loc: `/inzerat/${l.id}/${l.slug}`, lastmod: l.updatedAt, priority: 0.6 })));
  }
  const rows = await api<{ id: string; updatedAt: string }[]>(`/seo/sitemap/profiles?chunk=${chunk}`, { revalidate: 3600, auth: false }).catch(() => []);
  return urlset(rows.map((u) => ({ loc: `/uzivatel/${u.id}`, lastmod: u.updatedAt, priority: 0.4 })));
}
