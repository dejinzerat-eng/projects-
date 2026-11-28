'use client';
import { Clock, LayoutGrid, MapPin, Search, Sparkles, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { readMyLocation, type MyLocation } from '@/lib/my-location';
import { LocationButton, LocationPanel, locationQuery } from './search-location';

interface Suggest { queries: string[]; categories: { slug: string; name: string; parent: string | null; parentName: string | null }[]; cities: string[] }
const RECENT_KEY = 'dej_recent';

function readRecent(): string[] { try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; } }
function pushRecent(q: string) { try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((x) => x !== q)].slice(0, 6))); } catch { /* */ } }

/**
 * Vyhledávací pole s našeptávačem. `withLocation` = vpravo v poli volba lokality (obec / moje poloha + okruh),
 * která se přidá k hledání – na úvodní stránce nahrazuje dřívější sekci „Nabídky v okolí“.
 */
export function SearchBox({ initial = '', size = 'md', autoFocus, withLocation }: { initial?: string; size?: 'md' | 'lg'; autoFocus?: boolean; withLocation?: boolean }) {
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Suggest | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const [loc, setLoc] = useState<MyLocation | null>(null);
  const [locOpen, setLocOpen] = useState(false);

  useEffect(() => { if (withLocation) setLoc(readMyLocation()); }, [withLocation]);

  useEffect(() => setQ(initial), [initial]);
  useEffect(() => {
    if (q.trim().length < 2) { setData(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: ctl.signal }).then((r) => r.json()).then(setData).catch(() => {});
    }, 140);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) { setOpen(false); setLocOpen(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  type Opt = { kind: 'q' | 'cat' | 'city' | 'recent'; label: string; sub?: string; href: string };
  const opts: Opt[] = [];
  if (q.trim().length < 2) recent.forEach((r) => opts.push({ kind: 'recent', label: r, href: `/hledat?q=${encodeURIComponent(r)}&chytre=1` }));
  else if (data) {
    data.categories.forEach((c) => opts.push({ kind: 'cat', label: c.name, sub: c.parentName ?? 'Kategorie', href: c.parent ? `/kategorie/${c.parent}/${c.slug}` : `/kategorie/${c.slug}` }));
    data.queries.forEach((x) => opts.push({ kind: 'q', label: x, href: `/hledat?q=${encodeURIComponent(x)}` }));
    data.cities.forEach((c) => opts.push({ kind: 'city', label: `Vše v lokalitě ${c}`, href: `/hledat?mesto=${encodeURIComponent(c)}&okruh=20` }));
  }

  function go(href: string, label?: string) {
    if (label) pushRecent(label);
    setOpen(false);
    router.push(href);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (active >= 0 && opts[active]) return go(opts[active].href, opts[active].kind === 'q' || opts[active].kind === 'recent' ? opts[active].label : undefined);
    const t = q.trim();
    const where = withLocation ? locationQuery(loc) : '';
    const query = [t ? `q=${encodeURIComponent(t)}&chytre=1` : '', where].filter(Boolean).join('&');
    go(query ? `/hledat?${query}` : '/hledat', t || undefined);
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(opts.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Escape') { setOpen(false); setLocOpen(false); }
  }

  const lg = size === 'lg';
  const Icon = { q: Search, cat: LayoutGrid, city: MapPin, recent: Clock };
  return (
    <div ref={box} className="relative w-full">
      <form onSubmit={submit} role="search" onKeyDown={(e) => e.key === 'Escape' && setLocOpen(false)} className={`flex items-center rounded-2xl border bg-surface transition focus-within:border-ink-2 focus-within:ring-4 focus-within:ring-brand-soft ${lg ? 'h-12 border-line shadow-card pl-4' : 'h-11 border-line pl-3.5'}`}>
        <Search className={`${lg ? 'size-5' : 'size-[18px]'} shrink-0 text-muted`} aria-hidden />
        <input
          value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }} onFocus={() => { setRecent(readRecent()); setOpen(true); setLocOpen(false); }} onKeyDown={key}
          autoFocus={autoFocus} name="q" autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded={open && opts.length > 0} aria-controls={id} aria-autocomplete="list" aria-label="Co hledáte?"
          placeholder={lg ? 'Např. „iPhone 15 do 15 000 Kč“' : 'Hledat mezi inzeráty…'}
          className={`min-w-0 flex-1 bg-transparent px-3 outline-none placeholder:text-muted ${lg ? 'text-base sm:text-[17px]' : 'text-[15px]'}`}
        />
        {q && <button type="button" onClick={() => { setQ(''); setData(null); }} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Vymazat"><X className="size-4" /></button>}
        {withLocation && <>
          <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden />
          <LocationButton loc={loc} open={locOpen} onToggle={() => { setLocOpen((x) => !x); setOpen(false); }} />
        </>}
        <button type="submit" className={`btn btn-primary shrink-0 ${lg ? 'mx-1 h-10 rounded-xl px-3.5 sm:px-5' : 'mr-1 h-9 px-3.5 text-sm rounded-xl'}`}>
          <span className="sr-only sm:not-sr-only">Hledat</span><Search className="size-4 sm:hidden" />
        </button>
      </form>
      {withLocation && locOpen && (
        <LocationPanel loc={loc} onChange={setLoc} onShowNearby={(l) => { setLocOpen(false); router.push(`/hledat?${locationQuery(l)}`); }} />
      )}
      {open && !locOpen && opts.length > 0 && (
        <ul id={id} role="listbox" className="animate-fade-up absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface py-1.5 shadow-pop">
          {q.trim().length < 2 && <li className="px-4 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Nedávná hledání</li>}
          {opts.map((o, i) => {
            const I = Icon[o.kind];
            return (
              <li key={`${o.kind}-${o.label}`} role="option" aria-selected={i === active}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(o.href, o.kind === 'q' || o.kind === 'recent' ? o.label : undefined)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] ${i === active ? 'bg-surface-2' : ''}`}>
                  <I className="size-4 shrink-0 text-muted" />
                  <span className="truncate">{o.label}</span>
                  {o.sub && <span className="ml-auto shrink-0 text-xs text-muted">{o.sub}</span>}
                </button>
              </li>
            );
          })}
          {q.trim().length >= 2 && (
            <li className="border-t border-line mt-1 px-4 pt-2 pb-1.5 text-xs text-muted flex items-center gap-1.5"><Sparkles className="size-3.5 text-brand" />Rozumíme i větám jako „kolo v Brně do 8 tisíc“</li>
          )}
        </ul>
      )}
    </div>
  );
}
