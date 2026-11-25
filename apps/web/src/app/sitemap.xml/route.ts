import { meta, sitemapIndex } from '@/lib/sitemap';

/** Index sitemap: statické stránky + bloky inzerátů a profilů po {chunkSize} adresách. */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const m = await meta();
    const listingFiles = Math.max(1, Math.ceil(m.listingCount / m.chunkSize));
    const profileFiles = Math.ceil(m.profileCount / m.chunkSize);
    return sitemapIndex([
      { loc: '/sitemap/static.xml' },
      ...Array.from({ length: listingFiles }, (_, i) => ({ loc: `/sitemap/inzeraty-${i}.xml` })),
      ...Array.from({ length: profileFiles }, (_, i) => ({ loc: `/sitemap/profily-${i}.xml` })),
    ]);
  } catch {
    return sitemapIndex([{ loc: '/sitemap/static.xml' }]);
  }
}
