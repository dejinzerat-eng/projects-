import type { Metadata } from 'next';
import { CITIES, slugify, type City } from '@dej/shared';

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
export const SITE_NAME = 'Dejinzerat.cz';
/** Výchozí SEO úvodní stránky – v administraci (Správa SEO) je lze přepsat. */
export const HOME_TITLE = 'Dejinzerat.cz – moderní inzerce a bazar zdarma';
export const HOME_DESCRIPTION = 'Inzeráty zdarma z celé České republiky. Prodávejte a nakupujte rychle a bezpečně.';
export const abs = (path: string) => (/^https?:/.test(path) ? path : `${SITE}${path.startsWith('/') ? '' : '/'}${path}`);

/**
 * Open Graph + Twitter karta pro stránku. Next.js metadata slučuje jen do první úrovně,
 * proto u každé stránky skládáme celý objekt (siteName, locale…). Bez vlastního obrázku
 * se použije výchozí obrázek z app/opengraph-image.tsx.
 */
export function social(o: { title: string; description?: string; path?: string; image?: string | null; type?: 'website' | 'article' | 'profile' }): Pick<Metadata, 'openGraph' | 'twitter'> {
  const images = o.image ? [{ url: o.image }] : [{ url: '/opengraph-image', width: 1200, height: 630, alt: SITE_NAME }];
  return {
    openGraph: { title: o.title, description: o.description, url: o.path, siteName: SITE_NAME, locale: 'cs_CZ', type: o.type ?? 'website', images },
    twitter: { card: 'summary_large_image', title: o.title, description: o.description, images: images.map((i) => i.url) },
  };
}

/** Kanonická adresa výpisu: stránkování ?strana=N (N > 1) je vlastní kanonická URL, ostatní parametry se vynechají. */
export function listCanonical(path: string, strana: unknown) {
  const n = Number(Array.isArray(strana) ? strana[0] : strana);
  return Number.isInteger(n) && n > 1 ? `${path}?strana=${n}` : path;
}

/** Má výpis filtry (kromě stránkování)? Takové kombinace neindexujeme. */
export function hasFilters(sp: Record<string, string | string[] | undefined>, allowed: string[] = []) {
  return Object.entries(sp).some(([k, v]) => v !== undefined && v !== '' && k !== 'strana' && !allowed.includes(k));
}

/** Největší česká města pro lokální vstupní stránky (pořadí podle počtu obyvatel). */
export const TOP_CITIES = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice', 'Hradec Králové', 'Ústí nad Labem', 'Pardubice', 'Zlín', 'Havířov', 'Kladno', 'Most', 'Opava', 'Frýdek-Místek', 'Karviná', 'Jihlava', 'Teplice', 'Děčín', 'Karlovy Vary', 'Jablonec nad Nisou', 'Mladá Boleslav', 'Prostějov', 'Přerov', 'Třebíč', 'Chrudim', 'Znojmo', 'Kolín', 'Příbram'];
export const CZ_CITIES = CITIES.filter((c) => c.region.length === 3);
export const citySlug = (name: string) => slugify(name);
export function cityBySlug(slug: string): City | undefined {
  return CZ_CITIES.find((c) => citySlug(c.name) === slug);
}

