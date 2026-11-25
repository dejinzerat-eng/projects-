'use client';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { call } from '@/lib/client';

type Item = { id: string; title: string; status: string; rejectReason: string | null; appeal: { ref: string; status: string } | null };
const APPEAL_STATUS: Record<string, string> = { OPEN: 'námitku vyřizujeme', UPHELD: 'námitce vyhověno', REJECTED: 'námitka zamítnuta' };

/** Námitka proti rozhodnutí moderace (vnitřní systém vyřizování stížností, čl. 20 DSA). */
export function AppealForm({ items, selected }: { items: Item[]; selected?: string }) {
  const open = items.filter((i) => !i.appeal || i.appeal.status !== 'OPEN');
  const [listing, setListing] = useState(open.find((i) => i.id === selected)?.id ?? open[0]?.id ?? '');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const current = items.find((i) => i.id === listing);

  if (ref) return (
    <div className="card p-6" role="status">
      <CheckCircle2 className="size-10 text-brand" />
      <h2 className="mt-3 text-xl font-bold">Námitku jsme přijali</h2>
      <p className="mt-2 text-ink-2">Číslo námitky: <b className="font-mono">{ref}</b>. Posoudí ji jiný člen týmu, než který rozhodoval, a výsledek vám pošleme e-mailem i do upozornění.</p>
      <Link href="/muj-ucet/inzeraty" className="btn btn-primary mt-5">Moje inzeráty</Link>
    </div>
  );

  return (
    <div className="space-y-6">
      {items.some((i) => i.appeal) && (
        <ul className="card divide-y divide-line text-sm">
          {items.filter((i) => i.appeal).map((i) => <li key={i.id} className="flex flex-wrap justify-between gap-2 p-4"><span className="font-medium">{i.title}</span><span className="text-muted">{i.appeal!.ref} · {APPEAL_STATUS[i.appeal!.status]}</span></li>)}
        </ul>
      )}
      {open.length === 0 ? (
        <p className="card p-6 text-muted">Nemáte žádný inzerát stažený moderací, proti kterému by šlo podat námitku.</p>
      ) : (
        <form className="card space-y-5 p-5 sm:p-7" onSubmit={async (e) => {
          e.preventDefault(); setError(null); setBusy(true);
          try { setRef((await call<{ ref: string }>('/appeals', 'POST', { listing, text })).ref); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
        }}>
          <div>
            <label className="label" htmlFor="a-l">Inzerát</label>
            <select id="a-l" className="input" value={listing} onChange={(e) => setListing(e.target.value)}>
              {open.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
            {current?.rejectReason && <p className="mt-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm text-ink-2"><b>Důvod rozhodnutí:</b> {current.rejectReason}</p>}
          </div>
          <div>
            <label className="label" htmlFor="a-t">Proč s rozhodnutím nesouhlasíte?</label>
            <textarea id="a-t" rows={6} className="input" maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Popište, proč inzerát podle vás pravidla neporušuje. Můžete doplnit i fakta, která moderátor neznal." />
          </div>
          {error && <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>}
          <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>{busy ? 'Odesílám…' : 'Podat námitku'}</button>
        </form>
      )}
    </div>
  );
}
