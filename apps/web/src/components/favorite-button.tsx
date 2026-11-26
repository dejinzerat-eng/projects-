'use client';
import { Heart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { call } from '@/lib/client';
import { setFavorite, useFavorite } from '@/lib/favorites-store';
import { rememberInterest } from '@/lib/interest';
import { useToast } from './toast';

export function FavoriteButton({ id, initial = false, className = '', large, category }: { id: string; initial?: boolean; className?: string; large?: boolean; category?: { cat: string; sub: string } }) {
  const on = useFavorite(id, initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    const next = !on; setFavorite(id, next); setBusy(true);
    try {
      await call(`/listings/${id}/favorite`, next ? 'POST' : 'DELETE');
      toast(next ? 'Uloženo do oblíbených' : 'Odebráno z oblíbených');
      if (next && category) rememberInterest({ id, ...category });
      // Na stránce oblíbených odebraný inzerát rovnou zmizí
      if (!next && path === '/muj-ucet/oblibene') router.refresh();
    } catch (err) {
      setFavorite(id, !next);
      if ((err as Error).message.includes('přihlásit')) router.push(`/prihlaseni?zpet=${encodeURIComponent(location.pathname + location.search)}`);
      else toast((err as Error).message, 'error');
    } finally { setBusy(false); }
  }
  if (large) return (
    <button onClick={toggle} className={`btn btn-outline ${className}`} aria-pressed={on}>
      <Heart className={`size-5 ${on ? 'fill-brand text-brand' : ''}`} />{on ? 'V oblíbených' : 'Uložit'}
    </button>
  );
  return (
    <button onClick={toggle} aria-pressed={on} aria-label={on ? 'Odebrat z oblíbených' : 'Přidat do oblíbených'}
      className={`grid size-9 place-items-center rounded-full bg-surface/90 backdrop-blur shadow-card transition hover:scale-105 ${className}`}>
      <Heart className={`size-[18px] ${on ? 'fill-brand text-brand' : 'text-ink-2'}`} />
    </button>
  );
}
