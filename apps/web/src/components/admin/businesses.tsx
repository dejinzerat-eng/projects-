'use client';
import Link from 'next/link';
import { BadgeCheck } from 'lucide-react';
import { call } from '@/lib/client';
import { ago } from '@/lib/format';
import { useAct } from './dialog';

interface B { id: string; email: string; name: string; status: string; isBusiness: boolean; companyName: string | null; companyId: string | null; companyVerifiedAt: string | null; createdAt: string; activeListings: number; icoValid: boolean | null }

export function BusinessesTable({ rows }: { rows: B[] }) {
  const act = useAct();
  if (!rows.length) return <div className="card p-10 text-center text-muted">Žádné firemní účty.</div>;
  return (
    <ul className="card divide-y divide-line">
      {rows.map((b) => (
        <li key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/uzivatel/${b.id}`} target="_blank" className="font-semibold hover:underline">{b.companyName ?? b.name}</Link>
              {b.companyVerifiedAt ? <span className="badge bg-brand-soft text-brand-ink"><BadgeCheck className="size-3.5" />Ověřeno</span> : <span className="badge bg-surface-2">Neověřeno</span>}
              {!b.isBusiness && <span className="badge bg-top-soft">Soukromý účet s IČO</span>}
              {b.status !== 'ACTIVE' && <span className="badge bg-danger-soft text-danger">{b.status === 'BLOCKED' ? 'Zablokován' : 'Omezen'}</span>}
            </div>
            <div className="text-sm text-muted">IČO {b.companyId ?? '—'}{b.icoValid === false && <span className="text-danger"> (neplatný kontrolní součet)</span>} · {b.email}</div>
            <div className="text-xs text-muted">{b.activeListings} aktivních inzerátů · registrace {ago(b.createdAt)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {b.icoValid && !b.companyVerifiedAt && <button onClick={() => act(() => call(`/admin/businesses/${b.id}/ares`, 'POST'), 'Ověřeno podle ARES')} className="btn btn-dark btn-sm">Ověřit v ARES</button>}
            {b.icoValid && !b.companyVerifiedAt && <button onClick={() => act(() => call(`/admin/businesses/${b.id}`, 'PATCH', { verified: true }), 'Označeno jako ověřené')} className="btn btn-outline btn-sm">Ověřit ručně</button>}
            {b.companyVerifiedAt && <button onClick={() => act(() => call(`/admin/businesses/${b.id}`, 'PATCH', { verified: false }), 'Ověření zrušeno')} className="btn btn-ghost btn-sm">Zrušit ověření</button>}
            <button onClick={() => act(() => call(`/admin/businesses/${b.id}`, 'PATCH', { isBusiness: !b.isBusiness }), b.isBusiness ? 'Změněno na soukromý účet' : 'Změněno na firemní účet')} className="btn btn-ghost btn-sm">{b.isBusiness ? 'Na soukromý účet' : 'Na firemní účet'}</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
