'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { call } from '@/lib/client';
import { ago, listingUrl, STATUS_LABEL } from '@/lib/format';
import { useToast } from '../toast';

export type Notice = {
  id: string; ref: string; category: string; categoryLabel: string; targetUrl: string; targetType: string | null; explanation: string; reporterName: string | null; reporterEmail: string | null;
  status: 'RECEIVED' | 'ACTION_TAKEN' | 'NO_ACTION'; action: string | null; decisionReason: string | null; decidedAt: string | null; createdAt: string;
  listing: { id: string; slug: string; title: string; status: string } | null;
};
export type Appeal = {
  id: string; ref: string; text: string; status: 'OPEN' | 'UPHELD' | 'REJECTED'; decisionReason: string | null; createdAt: string; decidedAt: string | null;
  listing: { id: string; slug: string; title: string; status: string; rejectReason: string | null } | null; user: { id: string; name: string; email: string } | null;
};
const NOTICE_STATUS = { RECEIVED: 'Čeká na posouzení', ACTION_TAKEN: 'Obsah omezen', NO_ACTION: 'Bez zásahu' };
const APPEAL_STATUS = { OPEN: 'Čeká', UPHELD: 'Vyhověno', REJECTED: 'Zamítnuto' };

function useSubmit() {
  const router = useRouter(); const toast = useToast(); const [busy, setBusy] = useState(false);
  return { busy, run: async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { await fn(); toast(ok); router.refresh(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); } } };
}

export function NoticesList({ rows }: { rows: Notice[] }) {
  if (!rows.length) return <div className="card p-10 text-center text-muted">Žádná oznámení v tomto stavu.</div>;
  return <ul className="space-y-3">{rows.map((n) => <NoticeItem key={n.id} n={n} />)}</ul>;
}

function NoticeItem({ n }: { n: Notice }) {
  const { busy, run } = useSubmit();
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'reject' | 'delete' | 'none'>(n.listing ? 'reject' : 'none');
  const decide = (status: 'ACTION_TAKEN' | 'NO_ACTION') => run(() => call(`/admin/notices/${n.id}/decide`, 'POST', { status, action: status === 'NO_ACTION' ? 'none' : action, reason }), 'Rozhodnutí uloženo a odesláno');
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="badge bg-danger-soft text-danger">{n.categoryLabel}</span>
        <span className="font-mono font-semibold">{n.ref}</span>
        <span className="text-muted">{ago(n.createdAt)} · {n.reporterName ?? 'anonymně'}{n.reporterEmail ? ` (${n.reporterEmail})` : ''}</span>
      </div>
      <div className="mt-2 font-semibold">
        {n.listing ? <Link className="hover:underline" target="_blank" href={listingUrl(n.listing)}>{n.listing.title}</Link> : <a className="break-all hover:underline" href={n.targetUrl} target="_blank" rel="noopener noreferrer">{n.targetUrl}</a>}
        {n.listing && <span className="ml-2 text-xs font-normal text-muted">inzerát · {STATUS_LABEL[n.listing.status] ?? n.listing.status}</span>}
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{n.explanation}</p>
      {n.status === 'RECEIVED' ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div><label className="label text-xs" htmlFor={`r-${n.id}`}>Odůvodnění rozhodnutí (pošle se oznamovateli i autorovi)</label><textarea id={`r-${n.id}`} rows={2} className="input text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Např. Inzerát nabízí střelivo, jehož prodej bez zbrojního průkazu je zakázán." /></div>
          <div className="flex flex-wrap items-center gap-2">
            {n.listing && (
              <select className="input h-9 w-auto text-sm" value={action} onChange={(e) => setAction(e.target.value as typeof action)} aria-label="Opatření">
                <option value="reject">Stáhnout inzerát</option><option value="delete">Odstranit inzerát</option><option value="none">Bez automatického zásahu</option>
              </select>
            )}
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => decide('ACTION_TAKEN')}>Oznámení je oprávněné</button>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => decide('NO_ACTION')}>Bez zásahu</button>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm"><b>{NOTICE_STATUS[n.status]}</b>{n.action && n.action !== 'none' ? ` (${n.action === 'delete' ? 'odstraněno' : 'staženo'})` : ''} · {n.decidedAt && ago(n.decidedAt)} — {n.decisionReason}</p>
      )}
    </li>
  );
}

export function AppealsList({ rows }: { rows: Appeal[] }) {
  if (!rows.length) return <div className="card p-10 text-center text-muted">Žádné námitky v tomto stavu.</div>;
  return <ul className="space-y-3">{rows.map((a) => <AppealItem key={a.id} a={a} />)}</ul>;
}

function AppealItem({ a }: { a: Appeal }) {
  const { busy, run } = useSubmit();
  const [reason, setReason] = useState('');
  const decide = (status: 'UPHELD' | 'REJECTED') => run(() => call(`/admin/appeals/${a.id}/decide`, 'POST', { status, reason }), 'Rozhodnutí odesláno');
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="font-mono font-semibold">{a.ref}</span><span className="text-muted">{ago(a.createdAt)} · {a.user?.name} ({a.user?.email})</span></div>
      <div className="mt-2 font-semibold">{a.listing ? <Link className="hover:underline" target="_blank" href={listingUrl(a.listing)}>{a.listing.title}</Link> : 'Inzerát neexistuje'}{a.listing && <span className="ml-2 text-xs font-normal text-muted">{STATUS_LABEL[a.listing.status]}{a.listing.rejectReason ? ` · důvod: ${a.listing.rejectReason}` : ''}</span>}</div>
      <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{a.text}</p>
      {a.status === 'OPEN' ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-xs text-muted">Námitku má posoudit jiný moderátor než ten, kdo o inzerátu rozhodl.</p>
          <textarea rows={2} className="input text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Odůvodnění rozhodnutí o námitce" aria-label="Odůvodnění" />
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide('UPHELD')}>Vyhovět a obnovit inzerát</button>
            <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => decide('REJECTED')}>Zamítnout námitku</button>
          </div>
        </div>
      ) : <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm"><b>{APPEAL_STATUS[a.status]}</b> — {a.decisionReason}</p>}
    </li>
  );
}
