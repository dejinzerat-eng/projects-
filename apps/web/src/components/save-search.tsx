'use client';
import { BellPlus, BellRing } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SearchParams } from '@dej/shared';
import { call } from '@/lib/client';
import { useToast } from './toast';

/** Hlídání hledání. `savedId` = ID už uloženého stejného hledání (z načtení na serveru) – druhé kliknutí hlídání zruší. */
export function SaveSearch({ params, label, savedId = null }: { params: SearchParams; label: string; savedId?: string | null }) {
  const [id, setId] = useState(savedId);
  const [busy, setBusy] = useState(false);
  const toast = useToast(); const router = useRouter();
  async function toggle() {
    setBusy(true);
    try {
      if (id) {
        await call(`/me/saved-searches/${id}`, 'DELETE');
        setId(null); toast('Hlídání zrušeno.');
      } else {
        const { page: _p, sort: _s, ...query } = params;
        const r = await call<{ id: string }>('/me/saved-searches', 'POST', { name: label, query, notify: true });
        setId(r.id); toast('Hledání uloženo. Pošleme vám upozornění na nové inzeráty.');
      }
    } catch (e) {
      if ((e as Error).message.includes('přihlásit')) router.push(`/prihlaseni?zpet=${encodeURIComponent(location.pathname + location.search)}`);
      else toast((e as Error).message, 'error');
    } finally { setBusy(false); }
  }
  return (
    <button onClick={toggle} disabled={busy} aria-pressed={!!id} title={id ? 'Zrušit hlídání' : undefined} className="btn btn-outline btn-sm">
      {id ? <BellRing className="size-4 text-brand" /> : <BellPlus className="size-4" />}{id ? 'Hlídáte' : 'Hlídat nové inzeráty'}
    </button>
  );
}
