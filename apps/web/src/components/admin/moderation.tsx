'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { Permission } from '@dej/shared';
import { call } from '@/lib/client';
import { ago, listingUrl, price, STATUS_LABEL } from '@/lib/format';
import { useAct, useReasonDialog } from './dialog';

interface Row {
  id: string; slug: string; title: string; price: number | null; priceNegotiable: boolean; image: string | null; status: string; spamScore: number;
  riskReasons: string[]; riskLabels: string[]; images: { id: string; url: string; thumbUrl: string }[]; openReports: number;
  userEmail: string; userName: string; userId: string; userStatus: string; description: string; createdAt: number; city: string; categoryName: string;
  rejectReason: string | null; topUntil: string | null; highlightedUntil: string | null; currency?: string; offerType?: string;
}

const active = (v: string | null) => !!v && new Date(v) > new Date();
const until = (v: string) => new Date(v).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Prague' });

export function ModerationList({ rows, perms }: { rows: Row[]; perms: Permission[] }) {
  const sp = useSearchParams()!; const act = useAct(); const { ask, dialog } = useReasonDialog();
  const [edit, setEdit] = useState<Row | null>(null);
  const canModerate = perms.includes('listings.moderate'), canEdit = perms.includes('listings.edit'), canPromote = perms.includes('listings.promote');

  async function moderate(r: Row, action: 'approve' | 'reject' | 'delete') {
    let reason: string | undefined;
    if (action !== 'approve') {
      const v = await ask({ title: action === 'reject' ? 'Zamítnout inzerát' : 'Smazat inzerát', label: 'Důvod (uvidí ho autor)', confirm: action === 'reject' ? 'Zamítnout' : 'Smazat', danger: true, initial: r.riskReasons[0] ?? '' });
      if (v === null) return;
      reason = v;
    }
    await act(() => call(`/admin/listings/${r.id}/moderate`, 'POST', { action, reason }), action === 'approve' ? 'Schváleno' : action === 'reject' ? 'Zamítnuto' : 'Smazáno');
  }
  async function promote(r: Row, body: Record<string, unknown>, label: string, cancel = false) {
    const reason = await ask({ title: label, label: 'Důvod (do auditního logu)', placeholder: cancel ? 'Např. reklamace, ukončený firemní tarif…' : 'Např. kompenzace za výpadek, firemní tarif…', confirm: cancel ? 'Zrušit' : 'Přidělit', danger: cancel });
    if (reason !== null) await act(() => call(`/admin/listings/${r.id}/promote`, 'POST', { ...body, reason }), cancel ? 'Zrušeno' : 'Přiděleno');
  }

  const status = sp.get('status') ?? 'PENDING';
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {['PENDING', 'ACTIVE', 'REJECTED', 'EXPIRED', 'ALL'].map((s) => <Link key={s} href={`?status=${s}`} className={`chip ${status === s ? 'chip-active' : ''}`}>{s === 'ALL' ? 'Vše' : STATUS_LABEL[s]}</Link>)}
        <form className="w-full sm:ml-auto sm:w-auto"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={sp.get('q') ?? ''} placeholder="Hledat název, ID, e-mail…" aria-label="Hledat inzeráty" className="input h-9 w-full text-sm sm:w-60" /></form>
      </div>
      {!rows.length ? <div className="card p-10 text-center text-muted">Nic k zobrazení.</div> : (
        <ul className="space-y-3">{rows.map((r) => {
          const isTop = active(r.topUntil), isHighlighted = active(r.highlightedUntil);
          return (
          <li key={r.id} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="badge bg-surface-2">{STATUS_LABEL[r.status]}</span>
              {r.spamScore > 0 && <span className={`badge ${r.spamScore >= 50 ? 'bg-danger-soft text-danger' : 'bg-top-soft'}`}>Riziko {r.spamScore}</span>}
              {r.openReports > 0 && <span className="badge bg-danger-soft text-danger">Nahlášeno {r.openReports}×</span>}
              {r.userStatus !== 'ACTIVE' && <span className="badge bg-danger-soft text-danger">{r.userStatus === 'RESTRICTED' ? 'Účet omezen' : 'Účet zablokován'}</span>}
              {isTop && <span className="badge bg-top-soft">Top do {until(r.topUntil!)}</span>}
              {isHighlighted && <span className="badge bg-top-soft">Zvýrazněno do {until(r.highlightedUntil!)}</span>}
              <span className="text-muted">{r.categoryName} · {r.city} · {ago(r.createdAt)}</span>
            </div>
            {r.images.length > 0 ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" aria-label={`Fotografie (${r.images.length})`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {r.images.map((i, k) => <a key={i.id} href={i.url} target="_blank" rel="noreferrer" className="shrink-0"><img src={i.thumbUrl} alt={`Fotografie ${k + 1}`} loading="lazy" className="h-24 w-32 rounded-xl object-cover" /></a>)}
              </div>
            ) : <div className="text-xs text-muted">Bez fotografií</div>}
            <div className="min-w-0">
              <Link href={listingUrl(r)} target="_blank" className="block font-semibold hover:underline">{r.title} – {price(r.price, r.priceNegotiable, r.currency, r.offerType)}</Link>
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted">{r.description}</p>
              <p className="mt-1 text-xs text-muted">{r.userName} · {r.userEmail} · <Link href={`/admin/uzivatele?q=${encodeURIComponent(r.userEmail)}`} className="underline">účet</Link></p>
              {(r.riskLabels.length > 0 || r.riskReasons.length > 0) && <p className="mt-1 text-xs text-danger">Automat: {[...r.riskReasons.filter((x) => !x.startsWith('Možný') && !x.startsWith('Znaky')), ...r.riskLabels].join(' · ')}</p>}
              {r.rejectReason && <p className="mt-1 text-xs text-danger">Důvod zamítnutí: {r.rejectReason}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canModerate && r.status !== 'ACTIVE' && <button onClick={() => moderate(r, 'approve')} className="btn btn-sm bg-trust text-white">Schválit</button>}
              {canModerate && r.status !== 'REJECTED' && <button onClick={() => moderate(r, 'reject')} className="btn btn-outline btn-sm">Zamítnout</button>}
              {canEdit && <button onClick={() => setEdit(r)} className="btn btn-outline btn-sm">Upravit</button>}
              {canPromote && <button onClick={() => promote(r, { topDays: 7 }, isTop ? 'Topovat 7 dní (od teď)' : 'Topovat 7 dní')} className="btn btn-outline btn-sm">Topovat 7 dní</button>}
              {canPromote && isTop && <button onClick={() => promote(r, { topDays: 0 }, 'Zrušit topování', true)} className="btn btn-ghost btn-sm">Zrušit topování</button>}
              {canPromote && <button onClick={() => promote(r, { highlightDays: 7 }, isHighlighted ? 'Zvýraznit 7 dní (od teď)' : 'Zvýraznit 7 dní')} className="btn btn-outline btn-sm">Zvýraznit 7 dní</button>}
              {canPromote && isHighlighted && <button onClick={() => promote(r, { highlightDays: 0 }, 'Zrušit zvýraznění', true)} className="btn btn-ghost btn-sm">Zrušit zvýraznění</button>}
              {canPromote && <button onClick={() => promote(r, { bump: true }, 'Posunout na začátek')} className="btn btn-outline btn-sm">Posunout</button>}
              {canModerate && <button onClick={() => moderate(r, 'delete')} className="btn btn-danger btn-sm">Smazat</button>}

            </div>
          </li>
          );
        })}</ul>
      )}
      {edit && <StaffEdit row={edit} onClose={() => setEdit(null)} />}
      {dialog}
    </div>
  );
}

/** Úprava cizího inzerátu – důvod je povinný, autor dostane upozornění a změna se zapíše do auditu. */
function StaffEdit({ row, onClose }: { row: Row; onClose: () => void }) {
  const act = useAct();
  const [v, setV] = useState({ title: row.title, description: row.description, price: row.price == null ? '' : String(row.price), reason: '' });
  const priceVal = v.price.trim() === '' ? null : Number(v.price);
  return (
    <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="edit-t">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <form className="relative max-h-[92dvh] w-full max-w-xl space-y-3 overflow-y-auto rounded-t-3xl bg-surface p-6 sm:rounded-3xl" onSubmit={async (e) => {
        e.preventDefault();
        const body: Record<string, unknown> = { reason: v.reason };
        if (v.title !== row.title) body.title = v.title;
        if (v.description !== row.description) body.description = v.description;
        if (priceVal !== row.price) body.price = priceVal;
        if (await act(() => call(`/admin/listings/${row.id}`, 'PATCH', body), 'Inzerát upraven')) onClose();
      }}>
        <h2 id="edit-t" className="text-lg font-bold">Upravit inzerát uživatele</h2>
        <p className="text-sm text-muted">Autor ({row.userName}) dostane upozornění s důvodem. Změna se zapíše do auditního logu.</p>
        <div><label className="label" htmlFor="se-title">Název</label><input id="se-title" className="input" value={v.title} maxLength={90} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
        <div><label className="label" htmlFor="se-desc">Popis</label><textarea id="se-desc" rows={6} className="input" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
        <div><label className="label" htmlFor="se-price">Cena (Kč, prázdné = dohodou)</label><input id="se-price" inputMode="numeric" className="input" value={v.price} onChange={(e) => setV({ ...v, price: e.target.value.replace(/\D/g, '') })} /></div>
        <div><label className="label" htmlFor="se-reason">Důvod úpravy (povinné)</label><input id="se-reason" required minLength={3} className="input" placeholder="Např. odstranění kontaktu z názvu" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} /></div>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn btn-ghost">Zrušit</button><button className="btn btn-dark" disabled={v.reason.trim().length < 3}>Uložit</button></div>
      </form>
    </div>
  );
}
