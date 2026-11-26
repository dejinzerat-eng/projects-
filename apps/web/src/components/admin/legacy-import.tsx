'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { call } from '@/lib/client';
import { formatPrice } from '@dej/shared';
import { useToast } from '../toast';

type Item = { id: string; title: string; oldCategory: string; newCategory: string; price: number | null; place: string; images: number; action: 'new' | 'changed' | 'unchanged'; status: string; risk: string[]; listingId?: string };
type Scan = {
  source: string; complete: boolean; pageCount: number; total: number; sellers: number; images: number;
  counts: { new: number; changed: number; unchanged: number; review: number }; items: Item[];
  missing: { id: string; listingId: string; title: string; status: string }[];
};
type Result = { id: string; result: 'created' | 'updated' | 'unchanged' | 'edited' | 'gone' | 'error'; message?: string; listingId?: string; status?: string; warnings?: string[] };
export type InviteStatus = { legacy: number; pending: number; invited: number; claimed: number; withoutEmail: number; mailReady: boolean; webOrigin: string };

const RESULT_LABEL: Record<Result['result'], string> = { created: 'Přeneseno', updated: 'Aktualizováno', unchanged: 'Beze změny', edited: 'Upraveno v novém webu – nepřepsáno', gone: 'Na starém webu už není', error: 'Chyba' };
const ACTION_LABEL: Record<Item['action'], string> = { new: 'Nový', changed: 'Změněný', unchanged: 'Beze změny' };

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return <div className="card p-4"><div className="text-sm text-muted">{label}</div><div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>{hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}</div>;
}

export function LegacyImport() {
  const toast = useToast();
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'todo' | 'review'>('todo');
  const [run, setRun] = useState<{ total: number; done: Result[]; running: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try { setScan(await call<Scan>('/admin/legacy/scan', 'POST')); setRun(null); } catch (e) { toast((e as Error).message, 'error'); }
    setLoading(false);
  };

  const start = async () => {
    if (!scan) return;
    let ids = scan.items.map((i) => i.id);
    const done: Result[] = [];
    setRun({ total: ids.length, done, running: true });
    try {
      while (ids.length) {
        const r = await call<{ results: Result[]; remaining: string[] }>('/admin/legacy/run', 'POST', { ids });
        done.push(...r.results);
        setRun({ total: scan.items.length, done: [...done], running: true });
        if (!r.results.length) break;
        ids = r.remaining;
      }
      toast('Import dokončen');
    } catch (e) { toast(`Import se přerušil: ${(e as Error).message}. Spusťte ho znovu, pokračuje tam, kde skončil.`, 'error'); }
    setRun({ total: scan.items.length, done: [...done], running: false });
    router.refresh();
  };

  const archive = async () => {
    if (!scan || !confirm(`Stáhnout z nového webu ${scan.missing.length} inzerátů, které už na starém webu nejsou?`)) return;
    try { const r = await call<{ archived: number }>('/admin/legacy/archive-missing', 'POST', { ids: scan.missing.map((m) => m.id) }); toast(`Staženo ${r.archived} inzerátů`); await load(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  const items = scan?.items.filter((i) => filter === 'all' || (filter === 'todo' ? i.action !== 'unchanged' : i.status === 'PENDING')) ?? [];
  const count = (r: Result['result']) => run?.done.filter((d) => d.result === r).length ?? 0;
  const problems = run?.done.filter((d) => d.result === 'error' || d.result === 'edited' || d.warnings?.length) ?? [];

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">1. Náhled</h2>
        <p className="text-sm text-muted">Načte inzeráty ze starého webu a ukáže, co se s nimi stane. Zatím nic neukládá.</p>
        <button className="btn btn-dark" onClick={load} disabled={loading || !!run?.running}>{loading ? 'Načítám starý web…' : scan ? 'Načíst znovu' : 'Načíst náhled'}</button>
      </section>

      {scan && (
        <>
          {!scan.complete && <div className="card border-danger bg-danger-soft p-4 text-sm text-danger">Starý web nevrátil všechny stránky výpisu. Náhled může být neúplný – zkuste ho načíst znovu.</div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Inzeráty na starém webu" value={scan.total} hint={`${scan.sellers} prodejců, ${scan.images} fotek`} />
            <Stat label="Nové" value={scan.counts.new} hint={scan.counts.review ? `z toho ${scan.counts.review} ke schválení` : undefined} />
            <Stat label="Změněné na starém webu" value={scan.counts.changed} />
            <Stat label="Už přenesené, beze změny" value={scan.counts.unchanged} />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr">
            {([['todo', 'Nové a změněné'], ['review', 'Ke schválení'], ['all', 'Vše']] as const).map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'chip-active' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
          {items.length ? (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-left text-muted"><tr className="[&_th]:px-4 [&_th]:py-3 [&_th]:font-medium"><th>Inzerát</th><th>Stará kategorie</th><th>Nová kategorie</th><th>Místo</th><th className="text-right">Cena</th><th className="text-right">Fotky</th><th>Stav</th></tr></thead>
                <tbody>{items.map((i) => (
                  <tr key={i.id} className="border-t border-line align-top [&_td]:px-4 [&_td]:py-2.5">
                    <td className="max-w-[280px]">{i.listingId ? <Link href={`/inzerat/${i.listingId}/x`} target="_blank" className="font-medium hover:underline">{i.title}</Link> : <span className="font-medium">{i.title}</span>}</td>
                    <td className="text-muted">{i.oldCategory}</td>
                    <td>{i.newCategory}</td>
                    <td className="text-muted">{i.place}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatPrice(i.price, i.price == null)}</td>
                    <td className="text-right tabular-nums">{i.images}</td>
                    <td className="space-y-1">
                      <span className="badge bg-surface-2">{ACTION_LABEL[i.action]}</span>
                      {i.status === 'PENDING' && <div><span className="badge bg-top-soft text-ink">Ke schválení</span>{i.risk.length > 0 && <div className="mt-1 text-xs text-muted">{i.risk.join(', ')}</div>}</div>}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">V tomto výběru nic není.</p>}

          <section className="card space-y-3 p-5">
            <h2 className="text-lg font-bold">2. Import</h2>
            <p className="text-sm text-muted">Přenese inzeráty, fotky a prodejce. Prodejci dostanou účet bez hesla (pozvánku rozešlete níže). Podezřelé inzeráty čekají na schválení v sekci Inzeráty. Import lze spustit kdykoli znovu: doplní nové a změněné, nic nezdvojí a nepřepíše, co jste mezitím upravili v novém webu.</p>
            <button className="btn btn-primary" onClick={start} disabled={!!run?.running || !scan.items.length}>{run?.running ? 'Importuji…' : `Spustit import (${scan.items.length})`}</button>
            {run && (
              <div className="space-y-2" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-brand transition-all" style={{ width: `${run.total ? Math.round((run.done.length / run.total) * 100) : 0}%` }} /></div>
                <p className="text-sm">Zpracováno {run.done.length} z {run.total}. Přeneseno {count('created')}, aktualizováno {count('updated')}, beze změny {count('unchanged')}{count('edited') ? `, upraveno v novém webu ${count('edited')}` : ''}{count('gone') ? `, na starém webu už není ${count('gone')}` : ''}{count('error') ? `, chyby ${count('error')}` : ''}.</p>
                {!run.running && problems.length > 0 && (
                  <ul className="space-y-1 text-sm">{problems.map((p) => <li key={p.id}><span className="font-medium">{scan.items.find((i) => i.id === p.id)?.title ?? p.id}</span>: {p.result === 'error' || p.result === 'edited' ? (p.message ?? RESULT_LABEL[p.result]) : p.warnings?.join('; ')}</li>)}</ul>
                )}
              </div>
            )}
          </section>

          {scan.missing.length > 0 && (
            <section className="card space-y-3 p-5">
              <h2 className="text-lg font-bold">Inzeráty, které už na starém webu nejsou ({scan.missing.length})</h2>
              <ul className="list-disc pl-5 text-sm">{scan.missing.slice(0, 20).map((m) => <li key={m.id}><Link href={`/inzerat/${m.listingId}/x`} target="_blank" className="hover:underline">{m.title}</Link></li>)}</ul>
              {scan.missing.length > 20 && <p className="text-sm text-muted">… a dalších {scan.missing.length - 20}.</p>}
              <button className="btn btn-outline" onClick={archive}>Stáhnout je z nového webu</button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function LegacyInvites({ initial }: { initial: InviteStatus }) {
  const toast = useToast();
  const [st, setSt] = useState(initial);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      let total = 0;
      for (let i = 0; i < 50; i++) {
        const r = await call<{ sent: number; remaining: number }>('/admin/legacy/invites', 'POST', { confirm: true });
        total += r.sent;
        if (!r.remaining || !r.sent) break;
      }
      toast(`Odesláno ${total} pozvánek`);
      setSt(await call<InviteStatus>('/admin/legacy/invites'));
    } catch (e) { toast((e as Error).message, 'error'); }
    setBusy(false);
  };
  const site = st.webOrigin.replace(/^https?:\/\//, '');
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-bold">3. Rozeslat přístupy prodejcům</h2>
      <p className="text-sm text-muted">Každý prodejce ze starého webu dostane e-mail s odkazem, přes který si nastaví nové heslo (platí 14 dní, jen jednou). Hesla e-mailem neposíláme. Pozvánku dostane jen ten, kdo ji ještě nedostal a účet si zatím nepřevzal.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Čeká na pozvánku" value={st.pending} />
        <Stat label="Pozvánka odeslána" value={st.invited} />
        <Stat label="Účet převzali" value={st.claimed} />
        <Stat label="Bez e-mailu" value={st.withoutEmail} hint="nelze pozvat" />
      </div>
      {!st.mailReady ? (
        <p className="rounded-lg bg-surface-2 p-3 text-sm">Rozeslání bude možné po přepnutí na ostrou doménu a nastavení odesílání e-mailů (Resend). Do té doby se nic neodešle.</p>
      ) : (
        <>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5" checked={ok} onChange={(e) => setOk(e.target.checked)} /><span>Web už běží na ostré doméně <b>{site}</b> a odkazy v e-mailu povedou sem.</span></label>
          <button className="btn btn-primary" onClick={send} disabled={!ok || busy || !st.pending}>{busy ? 'Odesílám…' : `Rozeslat přístupy (${st.pending})`}</button>
        </>
      )}
    </section>
  );
}
