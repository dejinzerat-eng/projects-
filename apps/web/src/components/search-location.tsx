'use client';
import { ArrowRight, ChevronDown, Loader2, LocateFixed, MapPin, X } from 'lucide-react';
import { useState } from 'react';
import { currentPosition, nearestName, saveMyLocation, type MyLocation } from '@/lib/my-location';
import { LocationInput } from './location-input';

export const RADII = [10, 30, 50, 100];

/** Parametry URL pro zvolenou lokalitu: obec podle názvu (vyplní se i ve filtrech), poloha z prohlížeče podle souřadnic. */
export function locationQuery(loc: MyLocation | null): string {
  if (!loc) return '';
  const u = new URLSearchParams();
  if (loc.source === 'city' && loc.label) u.set('mesto', loc.label);
  else { u.set('lat', String(loc.lat)); u.set('lng', String(loc.lng)); }
  u.set('okruh', String(loc.radius));
  return u.toString();
}

/** Tlačítko lokality uvnitř vyhledávacího pole: „Celá ČR“, nebo „Brno +30 km“. */
export function LocationButton({ loc, open, onToggle }: { loc: MyLocation | null; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-haspopup="dialog"
      aria-label={loc ? `Lokalita: ${loc.name}, okruh ${loc.radius} km. Změnit` : 'Lokalita: celá ČR. Hledat v okolí'}
      className={`flex h-9 min-w-0 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium transition-colors hover:bg-surface-2 ${loc ? 'text-ink' : 'text-ink-2'} ${open ? 'bg-surface-2' : ''}`}>
      {loc?.source === 'gps' ? <LocateFixed className="size-4 shrink-0 text-brand" /> : <MapPin className={`size-4 shrink-0 ${loc ? 'text-brand' : 'text-muted'}`} />}
      <span className="hidden max-w-[150px] truncate sm:inline">{loc ? loc.name : 'Celá ČR'}</span>
      {loc && <span className="hidden shrink-0 text-muted sm:inline">+{loc.radius} km</span>}
      <ChevronDown className="hidden size-4 shrink-0 text-muted sm:block" />
    </button>
  );
}

/**
 * Výběr lokality pro hledání (dříve samostatná sekce „Nabídky v okolí“): poloha z prohlížeče nebo obec/PSČ + okruh.
 * Volba se pamatuje jen v tomto prohlížeči (stejně jako ve filtrech výsledků).
 */
export function LocationPanel({ loc, onChange, onShowNearby }: { loc: MyLocation | null; onChange: (l: MyLocation | null) => void; onShowNearby: (l: MyLocation) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const radius = loc?.radius ?? 30;

  function choose(l: MyLocation | null) { saveMyLocation(l); onChange(l); setErr(null); setText(''); }
  async function useGps() {
    setBusy(true); setErr(null);
    try {
      const p = await currentPosition();
      choose({ name: await nearestName(p.lat, p.lng), ...p, radius, source: 'gps' });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div role="dialog" aria-label="Kde hledat" className="animate-fade-up absolute right-0 top-full z-50 mt-2 w-full rounded-2xl border border-line bg-surface p-4 text-left shadow-pop sm:w-[340px]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">Hledat v okolí</span>
        {loc && <button type="button" onClick={() => choose(null)} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><X className="size-3.5" />Celá ČR</button>}
      </div>
      <button type="button" onClick={useGps} disabled={busy} className="btn btn-outline btn-sm w-full">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4 text-brand" />}Použít moji polohu
      </button>
      <div className="mt-2">
        <LocationInput value={text} onChange={setText} ariaLabel="Obec nebo PSČ" placeholder="nebo obec či PSČ" className="h-10"
          onSelect={(o) => choose({ name: o.name, label: o.label, lat: o.lat, lng: o.lng, radius, source: 'city' })} />
      </div>
      {err && <p className="mt-2 text-sm text-danger" role="alert">{err}</p>}
      {loc && (
        <>
          <div className="mt-3 text-xs font-semibold text-ink-2" id="okruh-l">Okruh</div>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="group" aria-labelledby="okruh-l">
            {RADII.map((r) => <button key={r} type="button" onClick={() => choose({ ...loc, radius: r })} aria-pressed={radius === r} className={`chip h-8 justify-center px-0 text-[13px] ${radius === r ? 'chip-active' : ''}`}>{r} km</button>)}
          </div>
          <button type="button" onClick={() => onShowNearby(loc)} className="btn btn-primary btn-sm mt-3 w-full">Zobrazit nabídky v okolí<ArrowRight className="size-4" /></button>
        </>
      )}
      {!loc && <p className="mt-3 text-xs text-muted">Polohu použijeme jen pro hledání a zůstane uložená pouze ve vašem prohlížeči.</p>}
    </div>
  );
}
