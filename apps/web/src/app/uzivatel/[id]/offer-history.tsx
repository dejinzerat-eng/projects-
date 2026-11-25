'use client';
import { useState } from 'react';
import { ListingGrid } from '@/components/listing-card';
import { useToast } from '@/components/toast';
import { call } from '@/lib/client';
import type { ListingCard } from '@/lib/types';

export interface HistoryPage { items: ListingCard[]; page: number; pages: number; total: number }

/** Prodané a ukončené nabídky prodejce – bez kontaktních tlačítek, s postupným načítáním. */
export function OfferHistory({ userId, initial }: { userId: string; initial: HistoryPage }) {
  const [items, setItems] = useState(initial.items);
  const [page, setPage] = useState(initial.page);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!items.length) return <p className="text-muted">Zatím žádné prodané ani ukončené nabídky.</p>;

  async function more() {
    setBusy(true);
    try {
      const r = await call<HistoryPage>(`/users/${userId}/history?page=${page + 1}`);
      setItems((cur) => [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))]);
      setPage(r.page);
    } catch (e) { toast((e as Error).message, 'error'); }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <ListingGrid items={items} />
      {page < initial.pages && (
        <div className="text-center">
          <button type="button" onClick={more} disabled={busy} className="btn btn-outline">{busy ? 'Načítám…' : `Zobrazit další (${initial.total - items.length})`}</button>
        </div>
      )}
    </div>
  );
}
