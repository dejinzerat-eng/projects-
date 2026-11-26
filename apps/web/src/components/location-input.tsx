'use client';
import { MapPin } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface LocationOption { name: string; label: string; district: string; region: string; regionName: string; zip: string; lat: number; lng: number }

/** Načte návrhy obcí z API (název bez diakritiky nebo PSČ). */
export async function fetchLocations(q: string, limit = 8, signal?: AbortSignal): Promise<LocationOption[]> {
  const r = await fetch(`/api/locations/suggest?q=${encodeURIComponent(q)}&limit=${limit}`, { signal });
  return r.ok ? r.json() : [];
}

/**
 * Pole pro obec s našeptávačem ze všech obcí ČR. `onSelect` se volá při výběru ze seznamu
 * (myší, Enterem, nebo když po opuštění pole text přesně odpovídá obci).
 */
export function LocationInput({ id, value, onChange, onSelect, placeholder = 'Město, obec nebo PSČ', className = '', autoFocus, ariaLabel }: {
  id?: string; value: string; onChange: (v: string) => void; onSelect: (o: LocationOption) => void;
  placeholder?: string; className?: string; autoFocus?: boolean; ariaLabel?: string;
}) {
  const [opts, setOpts] = useState<LocationOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const typed = useRef(false);

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || q.length < 2) { setOpts([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => { fetchLocations(q, 8, ctl.signal).then((o) => { setOpts(o); setActive(o.length ? 0 : -1); }).catch(() => {}); }, 120);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [value]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function choose(o: LocationOption) {
    typed.current = false;
    setOpen(false); setOpts([]);
    onSelect(o);
  }
  function key(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(opts.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && opts[active]) { e.preventDefault(); choose(opts[active]); }
    else if (e.key === 'Escape') setOpen(false);
  }
  function blur() {
    // Přesně napsaný název obce bereme jako výběr (bez klikání do seznamu)
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    // U nejednoznačného názvu (Říčany u Prahy × u Brna) nevybíráme za uživatele – musí zvolit ze seznamu
    const exact = opts.filter((o) => norm(o.name) === norm(value) || norm(o.label) === norm(value) || o.zip === value.replace(/\s/g, ''));
    if (typed.current && exact.length === 1) setTimeout(() => choose(exact[0]), 0);
  }

  const show = open && opts.length > 0;
  return (
    <div ref={box} className="relative">
      <MapPin className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        id={id} value={value} autoFocus={autoFocus} autoComplete="off" spellCheck={false} placeholder={placeholder} aria-label={ariaLabel}
        role="combobox" aria-expanded={show} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        className={`input pl-10 ${className}`}
        onChange={(e) => { typed.current = true; onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onKeyDown={key} onBlur={blur}
      />
      {show && (
        <ul id={listId} role="listbox" className="animate-fade-up absolute inset-x-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-pop">
          {opts.map((o, i) => (
            <li key={`${o.name}-${o.zip}-${o.district}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)}
                className={`flex w-full items-baseline gap-2 px-3.5 py-2 text-left text-[15px] ${i === active ? 'bg-surface-2' : ''}`}>
                <span className="truncate font-medium">{o.label}</span>
                <span className="ml-auto shrink-0 text-xs text-muted">{o.zip.slice(0, 3)} {o.zip.slice(3)}<span className="hidden sm:inline"> · {o.regionName.replace(' kraj', '').replace('Kraj ', '')}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
