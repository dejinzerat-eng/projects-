'use client';
import { useEffect, useRef } from 'react';
import { fetchLocations, LocationInput, type LocationOption } from './location-input';

const fmtZip = (z: string) => (/^\d{5}$/.test(z) ? `${z.slice(0, 3)} ${z.slice(3)}` : z);
const digits = (z: string) => z.replace(/\s/g, '');

/**
 * Lokalita a PSČ v průvodci vložením inzerátu. PSČ se doplní podle vybrané obce a při změně obce
 * se přepíše – pokud ho uživatel nenapsal ručně.
 */
export function LocationFields({ city, zip, onChange }: { city: string; zip: string; onChange: (v: { city?: string; zip?: string }) => void }) {
  // PSČ, které jsme doplnili sami; dokud se rovná poli PSČ, smíme ho měnit
  const autoZip = useRef<string | null>(null);
  const isAuto = (z: string) => !digits(z) || (autoZip.current !== null && digits(z) === autoZip.current);

  // U rozpracovaného/upravovaného inzerátu: odpovídá PSČ obci? Pak ho bereme jako doplněné automaticky.
  useEffect(() => {
    if (!city.trim() || !digits(zip)) return;
    let alive = true;
    fetchLocations(city, 3).then((o) => { if (alive && o.some((x) => x.zip === digits(zip))) autoZip.current = digits(zip); }).catch(() => {});
    return () => { alive = false; };
  }, []); // jen při načtení

  function select(o: LocationOption) {
    if (isAuto(zip)) { autoZip.current = o.zip; onChange({ city: o.label, zip: fmtZip(o.zip) }); }
    else onChange({ city: o.label });
  }
  function type(v: string) {
    // Jiné město než to, ke kterému jsme PSČ doplnili → automatické PSČ smažeme, doplní se po výběru
    if (autoZip.current && digits(zip) === autoZip.current) { autoZip.current = null; onChange({ city: v, zip: '' }); }
    else onChange({ city: v });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
      <div>
        <label className="label" htmlFor="city">Lokalita</label>
        <LocationInput id="city" value={city} onChange={type} onSelect={select} placeholder="Město nebo obec" />
        <p className="mt-1.5 text-xs text-muted">Vyberte obec ze seznamu – inzerát se pak najde i při hledání v okolí.</p>
      </div>
      <div>
        <label className="label" htmlFor="zip">PSČ</label>
        <input id="zip" inputMode="numeric" className="input" maxLength={6} value={zip} placeholder="110 00" autoComplete="postal-code"
          onChange={(e) => { autoZip.current = null; onChange({ zip: e.target.value.replace(/[^\d\s]/g, '') }); }} />
      </div>
    </div>
  );
}
