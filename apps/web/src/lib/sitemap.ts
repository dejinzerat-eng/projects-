import 'server-only';
import { api } from './api';
import { abs, citySlug, TOP_CITIES } from './seo';

/** Sitemapy: index /sitemap.xml → /sitemap/static.xml, /sitemap/inzeraty-N.xml, /sitemap/profily-N.xml. */
export interface SitemapMeta {
  chunkSize: number; listingCount: number; profileCount: number;
  categories: { path: string; lastModified: string | null }[];
  pages: { slug: string; updatedAt: string }[];
  locations: { category: string; city: string; count: number }[];
  cities: { city: string; count: number }[];
}
export type Url = { loc: string; lastmod?: string | Date | null; changefreq?: string; priority?: number };

export const meta = () => api<SitemapMeta>('/seo/sitemap', { revalidate: 3600, auth: false });

const x = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const iso = (d: string | Date | null | undefined) => (d ? new Date(d).toISOString() : undefined);

export function urlset(urls: Url[]) {
  const body = urls.map((u) => {
    const lm = iso(u.lastmod);
    return `<url><loc>${x(abs(u.loc))}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}${u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : ''}${u.priority != null ? `<priority>${u.priority}</priority>` : ''}</url>`;
  }).join('\n');
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
}

export function sitemapIndex(files: { loc: string; lastmod?: string | Date | null }[]) {
  const body = files.map((f) => { const lm = iso(f.lastmod); return `<sitemap><loc>${x(abs(f.loc))}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}</sitemap>`; }).join('\n');
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>`);
}

function xml(s: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${s}`, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' } });
}

const maxDate = (ds: (string | null | undefined)[]) => ds.reduce<string | null>((m, d) => (d && (!m || d > m) ? d : m), null);

export function staticUrls(m: SitemapMeta): Url[] {
  const newest = maxDate(m.categories.map((c) => c.lastModified));
  const top = new Set(TOP_CITIES);
  return [
    { loc: '/', lastmod: newest, changefreq: 'hourly', priority: 1 },
    ...m.categories.map((c) => ({ loc: c.path, lastmod: c.lastModified, changefreq: 'hourly', priority: c.path.split('/').length === 3 ? 0.8 : 0.7 })),
    ...m.cities.filter((c) => top.has(c.city)).map((c) => ({ loc: `/lokalita/${citySlug(c.city)}`, changefreq: 'daily', priority: 0.6 })),
    ...m.locations.filter((l) => top.has(l.city)).map((l) => ({ loc: `/kategorie/${l.category}/mesto/${citySlug(l.city)}`, changefreq: 'daily', priority: 0.5 })),
    ...m.pages.map((p) => ({ loc: `/stranka/${p.slug}`, lastmod: p.updatedAt, changefreq: 'monthly', priority: 0.3 })),
    { loc: '/nahlasit-obsah', changefreq: 'yearly', priority: 0.2 },
    { loc: '/cenik', changefreq: 'monthly', priority: 0.3 },
  ];
}
