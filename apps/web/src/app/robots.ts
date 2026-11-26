import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (process.env.NOINDEX === '1') return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/muj-ucet', '/zpravy', '/pridat', '/hledat', '/porovnani', '/namitka', '/prihlaseni', '/registrace', '/zapomenute-heslo', '/obnova-hesla', '/overeni-emailu', '/inzerat/*/upravit'] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
