'use client';
import Link from 'next/link';
import { ArrowLeft, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { call } from '@/lib/client';
import { ago, listingUrl } from '@/lib/format';
import { useToast } from '../toast';
import { MessageWarning, type MessageWarningData } from './message-warning';

interface Person { id: string; name: string; email: string; status: string; createdAt: string }
export interface AdminConv {
  id: string; createdAt: string; listing: { id: string; slug: string; title: string } | null; buyer: Person; seller: Person;
  messages: { id: string; senderId: string; body: string; imageUrl: string | null; createdAt: string; warning: MessageWarningData | null }[];
  reports: { id: string; targetType: string; targetId: string; reason: string; note: string | null; status: string; createdAt: string; reporter: { id: string; name: string } }[];
}

/** Moderátor: nahlášená konverzace jen ke čtení (zobrazení se zapisuje do auditu). */
export function AdminConversation({ c, isAdmin }: { c: AdminConv; isAdmin: boolean }) {
  const router = useRouter(); const toast = useToast();
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast(ok); router.refresh(); } catch (e) { toast((e as Error).message, 'error'); } };
  const people = [c.buyer, c.seller];
  const reportedMsgs = new Set(c.reports.filter((r) => r.targetType === 'MESSAGE').map((r) => r.targetId));
  const open = c.reports.filter((r) => r.status === 'OPEN');
  return (
    <div className="space-y-5">
      <Link href="/admin/nahlaseni" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" />Nahlášený obsah</Link>
      <div>
        <h1 className="h-display text-3xl font-bold">Nahlášená konverzace</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Eye className="size-4" aria-hidden />Jen ke čtení. Zobrazení je zapsané v auditu.</p>
      </div>
      <div className="card grid gap-4 p-4 sm:grid-cols-2">
        {people.map((p) => (
          <div key={p.id} className="min-w-0">
            <div className="text-xs text-muted">{p.id === c.buyer.id ? (c.listing ? 'Zájemce' : 'Začal(a) konverzaci') : (c.listing ? 'Prodejce' : 'Příjemce')}</div>
            <Link href={`/uzivatel/${p.id}`} target="_blank" className="font-semibold hover:underline">{p.name}</Link>
            <div className="truncate text-sm text-muted">{p.email} · {p.status === 'ACTIVE' ? 'aktivní' : 'zablokovaný'}</div>
            {isAdmin && p.status === 'ACTIVE' && <button onClick={() => confirm(`Zablokovat účet ${p.email}? Jeho inzeráty budou staženy.`) && act(() => call(`/admin/users/${p.id}`, 'PATCH', { status: 'BLOCKED' }), 'Účet zablokován')} className="btn btn-danger btn-sm mt-2">Zablokovat účet</button>}
          </div>
        ))}
        <div className="text-sm sm:col-span-2">{c.listing ? <>Inzerát: <Link href={listingUrl(c.listing)} target="_blank" className="font-semibold hover:underline">{c.listing.title}</Link></> : 'Konverzace z profilu (bez inzerátu)'} · založena {ago(c.createdAt)}</div>
      </div>

      <section className="card p-4">
        <h2 className="mb-3 font-bold">Hlášení ({c.reports.length})</h2>
        <ul className="space-y-3">{c.reports.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-sm">
              <span className="badge bg-danger-soft text-danger">{r.reason}</span>
              <span className="ml-2 text-muted">{r.targetType === 'MESSAGE' ? 'Zpráva' : 'Konverzace'} · {r.reporter.name} · {ago(r.createdAt)} · {r.status === 'OPEN' ? 'otevřené' : r.status === 'RESOLVED' ? 'vyřešené' : 'zamítnuté'}</span>
              {r.note && <p className="mt-1 text-muted">„{r.note}“</p>}
            </div>
            {r.status === 'OPEN' && <div className="flex shrink-0 gap-2">
              <button onClick={() => act(() => call(`/admin/reports/${r.id}/resolve`, 'POST', { status: 'RESOLVED' }), 'Označeno jako vyřešené')} className="btn btn-dark btn-sm">Vyřešeno</button>
              <button onClick={() => act(() => call(`/admin/reports/${r.id}/resolve`, 'POST', { status: 'DISMISSED' }), 'Hlášení zamítnuto')} className="btn btn-outline btn-sm">Zamítnout</button>
            </div>}
          </li>
        ))}</ul>
        {!open.length && <p className="mt-2 text-sm text-muted">Všechna hlášení jsou vyřízená.</p>}
      </section>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line p-4 font-bold">Zprávy ({c.messages.length})</h2>
        <ol className="space-y-3 bg-paper p-4">{c.messages.map((m) => {
          const who = m.senderId === c.buyer.id ? c.buyer : c.seller;
          const left = m.senderId === c.buyer.id;
          return (
            <li key={m.id} className={`flex flex-col ${left ? 'items-start' : 'items-end'}`}>
              <div className={`max-w-[85%] rounded-2xl border px-3.5 py-2 text-[15px] ${reportedMsgs.has(m.id) ? 'border-danger' : 'border-line'} ${left ? 'bg-surface' : 'bg-surface-2'}`}>
                <div className="mb-0.5 text-xs font-semibold text-muted" suppressHydrationWarning>{who.name} · {new Date(m.createdAt).toLocaleString('cs-CZ')}{reportedMsgs.has(m.id) && <span className="ml-1 text-danger">· nahlášená</span>}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.imageUrl && <img src={m.imageUrl} alt="Fotka ve zprávě" className="mb-1 max-h-64 rounded-xl" loading="lazy" />}
                {m.body && <p className="whitespace-pre-line break-words">{m.body}</p>}
              </div>
              {m.warning && <MessageWarning w={m.warning} />}
            </li>
          );
        })}</ol>
      </section>
    </div>
  );
}
