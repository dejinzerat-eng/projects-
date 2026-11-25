'use client';

/** Zvolená poloha návštěvníka pro „Nabídky v okolí“ – jen v prohlížeči (localStorage). */
export interface MyLocation { name: string; lat: number; lng: number; radius: number; source: 'gps' | 'city' }
const KEY = 'dej_location';

export function readMyLocation(): MyLocation | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return v && typeof v.name === 'string' && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? { radius: 30, source: 'city', ...v } : null;
  } catch { return null; }
}
export function saveMyLocation(l: MyLocation | null) {
  try { if (l) localStorage.setItem(KEY, JSON.stringify(l)); else localStorage.removeItem(KEY); } catch { /* */ }
}

/** Poloha z prohlížeče (zeptá se uživatele na svolení). */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Prohlížeč nepodporuje zjištění polohy.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Math.round(p.coords.latitude * 1e4) / 1e4, lng: Math.round(p.coords.longitude * 1e4) / 1e4 }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? 'Přístup k poloze je zakázaný. Povolte ho v prohlížeči, nebo vyberte obec.' : 'Polohu se nepodařilo zjistit. Vyberte obec.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60_000 },
    );
  });
}

/** Název nejbližší obce k souřadnicím. */
export async function nearestName(lat: number, lng: number): Promise<string> {
  try { const r = await fetch(`/api/locations/nearest?lat=${lat}&lng=${lng}`); if (r.ok) return (await r.json()).name; } catch { /* */ }
  return 'Moje poloha';
}
