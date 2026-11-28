import { z } from 'zod';

/** Kolik bannerů se na úvodní stránce zobrazí vedle sebe. */
export const PUBLIC_BANNERS = 3;
/** Největší soubor obrázku banneru (limit požadavku na Vercelu je 4,5 MB). */
export const MAX_BANNER_BYTES = 4 * 1024 * 1024;

/** Odkaz banneru: celá adresa https:// (http://) nebo cesta na našem webu začínající „/“. Prázdný = bez odkazu. */
export function validBannerLink(v: string): boolean {
  if (/^\/(?!\/)[^\s]*$/.test(v)) return true;
  try {
    const u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') && !!u.hostname && !u.username && !u.password && !/\s/.test(v);
  } catch { return false; }
}

/** Přepínač z formuláře (multipart posílá text) i z JSONu. */
const flag = z.union([z.boolean(), z.enum(['true', 'false', '1', '0', 'on'])]).transform((v) => v === true || v === 'true' || v === '1' || v === 'on');

/** Pole formuláře banneru (multipart i JSON). */
export const BannerFields = z.object({
  alt: z.string().trim().min(2, 'Vyplňte krátký popis banneru (pro nevidomé a vyhledávače).').max(160, 'Popis může mít nejvýše 160 znaků.'),
  linkUrl: z.string().trim().max(500, 'Odkaz je příliš dlouhý.').transform((v) => v || null)
    .refine((v) => v === null || validBannerLink(v), 'Odkaz musí začínat https:// (nebo / pro stránku na našem webu).').optional(),
  active: flag.optional(),
});
