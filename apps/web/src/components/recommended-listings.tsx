'use client';
import { useEffect, useState } from 'react';
import { loadFavoriteIds } from '@/lib/favorites-store';
import { interestQuery } from '@/lib/interest';
import type { ListingCard } from '@/lib/types';
import { HomeSection } from './home-section';
import { ListingGrid } from './listing-card';

/**
 * „Doporučeno pro vás“ podle kategorií prohlížených a oblíbených inzerátů.
 * Nepřihlášenému se zájmy pamatují jen v prohlížeči; bez zájmů se sekce nezobrazí.
 */
export function RecommendedListings({ loggedIn }: { loggedIn: boolean }) {
  const [data, setData] = useState<{ hits: ListingCard[]; basedOn: string[]; favs: Set<string> } | null>(null);

  useEffect(() => {
    const q = interestQuery();
    if (!q && !loggedIn) return;
    const qs = new URLSearchParams({ limit: '8', ...(q ?? {}) });
    let alive = true;
    Promise.all([
      fetch(`/api/search/recommended?${qs}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : { hits: [], basedOn: [] })),
      loggedIn ? loadFavoriteIds() : Promise.resolve(new Set<string>()),
    ]).then(([r, favs]) => { if (alive) setData({ ...r, favs }); }).catch(() => {});
    return () => { alive = false; };
  }, [loggedIn]);

  if (!data?.hits.length) return null;
  return (
    <HomeSection id="pro-vas" title="Doporučeno pro vás" subtitle={data.basedOn.length ? `Podle toho, co vás zajímá: ${data.basedOn.slice(0, 3).join(', ')}` : undefined}>
      <ListingGrid items={data.hits} favorites={data.favs} />
    </HomeSection>
  );
}
