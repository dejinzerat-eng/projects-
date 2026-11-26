'use client';
import { Loader2, LocateFixed, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadFavoriteIds } from '@/lib/favorites-store';
import { currentPosition, nearestName, readMyLocation, saveMyLocation, type MyLocation } from '@/lib/my-location';
import type { ListingCard, SearchResult } from '@/lib/types';
import { GridSkeleton, HomeSection } from './home-section';
import { ListingGrid } from './listing-card';
import { fetchLocations, LocationInput } from './location-input';

const RADII = [10, 30, 50, 100];

/**
 * „Nabídky v okolí“: poloha z prohlížeče (až po kliknutí) nebo zvolená obec, uložená v localStorage.
 * Přihlášenému se nabídne obec z profilu.
 */
export function NearbyListings({ profileCity, loggedIn }: { profileCity?: string | null; loggedIn: boolean }) {
  const [ready, setReady] = useState(false);
  const [loc, setLoc] = useState<MyLocation | null>(null);
  const [picking, setPicking] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hits, setHits] = useState<ListingCard[] | null>(null);
  const [favs, setFavs] = useState<Set<string>>();

  useEffect(() => {
    const saved = readMyLocation();
    if (saved) { setLoc(saved); setReady(true); return; }
    if (!profileCity) { setReady(true); return; }
    fetchLocations(profileCity, 1).then(([m]) => { if (m) setLoc({ name: m.name, lat: m.lat, lng: m.lng, radius: 30, source: 'city' }); }).catch(() => {}).finally(() => setReady(true));
  }, [profileCity]);

  useEffect(() => {
    if (!loc) return;
    let alive = true;
    setHits(null);
    Promise.all([
      fetch(`/api/search?lat=${loc.lat}&lng=${loc.lng}&okruh=${loc.radius}&limit=8`).then((r) => (r.ok ? r.json() as Promise<SearchResult> : null)),
      loggedIn ? loadFavoriteIds() : Promise.resolve(undefined),
    ]).then(([r, f]) => { if (alive) { setHits(r?.hits ?? []); setFavs(f); } }).catch(() => alive && setHits([]));
    return () => { alive = false; };
  }, [loc, loggedIn]);

  function choose(l: MyLocation) { saveMyLocation(l); setLoc(l); setPicking(false); setErr(null); setText(''); }
  async function useGps() {
    setBusy(true); setErr(null);
    try {
      const p = await currentPosition();
      choose({ name: await nearestName(p.lat, p.lng), ...p, radius: loc?.radius ?? 30, source: 'gps' });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!ready) return <HomeSection id="okoli" title="Nabídky v okolí"><GridSkeleton /></HomeSection>;

  const picker = (
    <div className="card p-5 sm:p-6">
      {!loc && <p className="mb-4 text-ink-2">Ukážeme vám nabídky poblíž. Polohu použijeme jen pro hledání a zůstane uložená pouze ve vašem prohlížeči.</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <button onClick={useGps} disabled={busy} className="btn btn-primary shrink-0">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}Použít moji polohu
        </button>
        <div className="flex-1 sm:max-w-sm">
          <LocationInput value={text} onChange={setText} ariaLabel="Obec pro nabídky v okolí" placeholder="nebo napište obec či PSČ"
            onSelect={(o) => choose({ name: o.name, lat: o.lat, lng: o.lng, radius: loc?.radius ?? 30, source: 'city' })} />
        </div>
        {loc && <button onClick={() => setPicking(false)} className="btn btn-ghost shrink-0">Zrušit</button>}
      </div>
      {err && <p className="mt-3 text-sm text-danger" role="alert">{err}</p>}
    </div>
  );

  if (!loc) return <HomeSection id="okoli" title="Nabídky v okolí">{picker}</HomeSection>;

  const href = `/hledat?lat=${loc.lat}&lng=${loc.lng}&okruh=${loc.radius}`;
  return (
    <HomeSection id="okoli" title="Nabídky v okolí" href={hits?.length ? href : undefined} subtitle={
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1">{loc.source === 'gps' ? <LocateFixed className="size-3.5" /> : <MapPin className="size-3.5" />}{loc.name} a okolí</span>
        <select value={loc.radius} onChange={(e) => choose({ ...loc, radius: Number(e.target.value) })} aria-label="Okruh" className="rounded-md bg-transparent font-medium text-ink-2 hover:text-ink">
          {RADII.map((r) => <option key={r} value={r}>do {r} km</option>)}
        </select>
        <button onClick={() => setPicking((x) => !x)} className="font-medium text-brand-ink hover:underline">Změnit</button>
      </span>
    }>
      {picking && <div className="mb-4">{picker}</div>}
      {hits === null ? <GridSkeleton /> : hits.length ? <ListingGrid items={hits} favorites={favs} /> : (
        <div className="card p-8 text-center text-muted">
          V okruhu {loc.radius} km zatím nic není.{' '}
          {loc.radius < 100 ? <button onClick={() => choose({ ...loc, radius: 100 })} className="font-semibold text-brand-ink hover:underline">Rozšířit na 100 km</button>
            : <Link href="/hledat" className="font-semibold text-brand-ink hover:underline">Prohlédnout celou ČR</Link>}
        </div>
      )}
    </HomeSection>
  );
}
