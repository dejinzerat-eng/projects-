'use client';

export interface Banner { id: string; imageUrl: string; linkUrl: string | null; alt: string }

/** Kliknutí započítáme na pozadí – odkaz vede rovnou na cíl, takže funguje i bez JavaScriptu. */
function track(id: string) {
  try { navigator.sendBeacon?.(`/api/banners/${id}/click`); } catch { /* */ }
}

/**
 * Řada reklamních bannerů na úvodní stránce (nejvýše 3 vedle sebe, na mobilu pod sebou).
 * Spravuje se v administraci › Reklamní bannery; bez aktivních bannerů se nevykreslí nic.
 */
export function HomeBanners({ banners }: { banners: Banner[] }) {
  if (!banners.length) return null;
  return (
    <section className="container-x pt-12 sm:pt-16" aria-label="Reklama">
      <ul className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
        {banners.map((b) => {
          const external = !!b.linkUrl && !b.linkUrl.startsWith('/');
          const img = (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt={b.alt} loading="lazy" decoding="async" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
              <span className="absolute left-2 top-2 rounded bg-surface/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Reklama</span>
            </>
          );
          const box = 'group relative block aspect-[2/1] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface-2';
          return (
            <li key={b.id} className="sm:w-[calc((100%-2rem)/3)]">
              {b.linkUrl ? (
                <a href={b.linkUrl} onClick={() => track(b.id)} className={box} {...(external ? { target: '_blank', rel: 'sponsored noopener' } : {})}>{img}</a>
              ) : <div className={box}>{img}</div>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
