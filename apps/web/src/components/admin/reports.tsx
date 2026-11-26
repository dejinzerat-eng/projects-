'use client';
import Link from 'next/link';
import type { Permission } from '@dej/shared';
import { call } from '@/lib/client';
import { ago, listingUrl, STATUS_LABEL } from '@/lib/format';
import { useAct, useReasonDialog } from './dialog';

type Person = { id: string; name: string; email?: string; status: string; role: string };
interface Target {
  targetType: string; targetId: string;
  listing?: { id: string; slug: string; title: string; status: string; userId: string; user: Person };
  user?: Person & { email: string };
  message?: { id: string; body: string; imageUrl: string | null; createdAt: string; conversationId: string; sender: Person & { email: string }; conversation: { listing: { id: string; title: string; slug: string } | null } };
  conversation?: { id: string; buyer: Person & { email: string }; seller: Person & { email: string }; listing: { id: string; title: string; slug: string } | null };
}
interface Report { id: string; reason: string; note: string | null; createdAt: string; reporter: { id: string; name: string; email: string }; status: string; resolutionNote: string | null; resolvedAt: string | null; resolvedBy: { name: string } | null }
type Group = Target & { key: string; reports: Report[]; count: number; distinctReporters: number; lastAt: string };
type History = Target & Report;

const TYPE = { LISTING: 'Inzerát', USER: 'Uživatel', MESSAGE: 'Zpráva', CONVERSATION: 'Konverzace' } as Record<string, string>;
const owner = (t: Target): Person | undefined => t.listing?.user ?? t.user ?? t.message?.sender;

function TargetView({ t }: { t: Target }) {
  if (t.listing) return <Link className="font-semibold hover:underline" target="_blank" href={listingUrl(t.listing)}>{t.listing.title}</Link>;
  if (t.user) return <Link className="font-semibold hover:underline" target="_blank" href={`/uzivatel/${t.user.id}`}>{t.user.name} <span className="font-normal text-muted">({t.user.email})</span></Link>;
  if (t.message) return (
    <div>
      <blockquote className="whitespace-pre-line rounded-xl bg-surface-2 px-3 py-2 text-sm">{t.message.body || '(obrázek)'}</blockquote>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {t.message.imageUrl && <a href={t.message.imageUrl} target="_blank" rel="noreferrer"><img src={t.message.imageUrl} alt="Příloha zprávy" className="mt-2 h-24 rounded-xl object-cover" /></a>}
      <p className="mt-1 text-xs text-muted">Od {t.message.sender.name} ({t.message.sender.email}) · {ago(t.message.createdAt)}{t.message.conversation.listing && <> · k inzerátu <Link className="underline" target="_blank" href={listingUrl(t.message.conversation.listing)}>{t.message.conversation.listing.title}</Link></>} · <Link className="underline" href={`/admin/konverzace/${t.message.conversationId}`}>celá konverzace</Link></p>
    </div>
  );
  if (t.conversation) return (
    <div>
      <Link className="font-semibold hover:underline" href={`/admin/konverzace/${t.conversation.id}`}>Zobrazit konverzaci (jen ke čtení)</Link>
      <p className="mt-1 text-xs text-muted">{t.conversation.buyer.name} ({t.conversation.buyer.email}) ↔ {t.conversation.seller.name} ({t.conversation.seller.email}){t.conversation.listing && <> · k inzerátu <Link className="underline" target="_blank" href={listingUrl(t.conversation.listing)}>{t.conversation.listing.title}</Link></>}</p>
    </div>
  );
  return <span className="text-muted">Obsah už neexistuje ({t.targetId})</span>;
}

export function Reports({ data, perms }: { data: { status: string; groups: Group[]; history: History[] }; perms: Permission[] }) {
  const act = useAct(); const { ask, dialog } = useReasonDialog();
  const can = (p: Permission) => perms.includes(p);
  const resolve = (id: string, status: 'RESOLVED' | 'DISMISSED', note?: string) => call(`/admin/reports/${id}/resolve`, 'POST', { status, note });

  async function close(g: Group, status: 'RESOLVED' | 'DISMISSED') {
    const note = await ask({ title: status === 'RESOLVED' ? 'Označit jako vyřízené' : 'Zamítnout nahlášení', label: 'Poznámka pro oznamovatele', required: false, confirm: status === 'RESOLVED' ? 'Vyřízeno' : 'Zamítnout', hint: g.count > 1 ? `Vyřídí se všech ${g.count} nahlášení tohoto cíle najednou.` : undefined });
    if (note !== null) await act(() => resolve(g.reports[0].id, status, note || undefined), 'Vyřízeno');
  }
  async function takeDown(g: Group) {
    const reason = await ask({ title: 'Stáhnout inzerát', label: 'Důvod (uvidí ho autor i oznamovatelé)', initial: g.reports[0].reason, confirm: 'Stáhnout', danger: true });
    if (reason !== null) await act(() => call(`/admin/listings/${g.listing!.id}/moderate`, 'POST', { action: 'reject', reason }).then(() => resolve(g.reports[0].id, 'RESOLVED', `Inzerát byl stažen: ${reason}`)), 'Inzerát stažen');
  }
  async function setUser(g: Group, status: 'BLOCKED' | 'RESTRICTED') {
    const p = owner(g)!;
    const reason = await ask({ title: status === 'BLOCKED' ? `Zablokovat účet ${p.name}` : `Omezit účet ${p.name}`, hint: status === 'BLOCKED' ? 'Účet se odhlásí a jeho aktivní inzeráty budou staženy.' : 'Účet nebude moci zveřejňovat inzeráty ani psát zprávy, dokud omezení nezrušíte.', initial: g.reports[0].reason, confirm: status === 'BLOCKED' ? 'Zablokovat' : 'Omezit', danger: true });
    if (reason !== null) await act(() => call(`/admin/users/${p.id}/status`, 'POST', { status, reason }).then(() => resolve(g.reports[0].id, 'RESOLVED', status === 'BLOCKED' ? 'Účet byl zablokován.' : 'Účet byl omezen.')), status === 'BLOCKED' ? 'Účet zablokován' : 'Účet omezen');
  }

  const tabs = [['OPEN', 'Otevřená'], ['RESOLVED', 'Vyřízená'], ['DISMISSED', 'Zamítnutá']];
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">{tabs.map(([s, l]) => <Link key={s} href={`?status=${s}`} className={`chip ${data.status === s ? 'chip-active' : ''}`}>{l}</Link>)}</div>
      {data.status === 'OPEN' ? (
        !data.groups.length ? <div className="card p-10 text-center text-muted">Žádná otevřená nahlášení.</div> : (
          <ul className="space-y-3">{data.groups.map((g) => {
            const p = owner(g);
            const regular = p?.role === 'USER';
            return (
              <li key={g.key} className="card space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="badge bg-surface-2">{TYPE[g.targetType]}</span>
                  {g.count > 1 && <span className="badge bg-danger-soft text-danger">Nahlášeno {g.count}× · {g.distinctReporters} {g.distinctReporters === 1 ? 'uživatel' : g.distinctReporters < 5 ? 'uživatelé' : 'uživatelů'}</span>}
                  {g.listing && <span className="text-muted">{STATUS_LABEL[g.listing.status]}</span>}
                  {p && p.status !== 'ACTIVE' && <span className="badge bg-danger-soft text-danger">{p.status === 'RESTRICTED' ? 'Účet omezen' : 'Účet zablokován'}</span>}
                  <span className="text-muted">naposledy {ago(g.lastAt)}</span>
                </div>
                <TargetView t={g} />
                <ul className="space-y-1 border-l-2 border-line pl-3 text-sm">
                  {g.reports.slice(0, 5).map((r) => <li key={r.id}><span className="font-medium text-danger">{r.reason}</span> <span className="text-muted">– {r.reporter.name}, {ago(r.createdAt)}</span>{r.note && <span className="block text-muted">„{r.note}“</span>}</li>)}
                  {g.reports.length > 5 && <li className="text-muted">a dalších {g.reports.length - 5}…</li>}
                </ul>
                {can('reports.handle') && (
                  <div className="flex flex-wrap gap-2">
                    {g.listing && can('listings.moderate') && g.listing.status !== 'REJECTED' && <button onClick={() => takeDown(g)} className="btn btn-danger btn-sm">Stáhnout inzerát</button>}
                    {p && regular && can('users.block') && p.status !== 'BLOCKED' && <button onClick={() => setUser(g, 'BLOCKED')} className="btn btn-danger btn-sm">{g.message ? 'Zablokovat odesílatele' : g.listing ? 'Zablokovat autora' : 'Zablokovat účet'}</button>}
                    {p && regular && can('users.restrict') && p.status === 'ACTIVE' && <button onClick={() => setUser(g, 'RESTRICTED')} className="btn btn-outline btn-sm">Omezit účet</button>}
                    <button onClick={() => close(g, 'RESOLVED')} className="btn btn-outline btn-sm">Vyřízeno</button>
                    <button onClick={() => close(g, 'DISMISSED')} className="btn btn-ghost btn-sm">Zamítnout</button>
                  </div>
                )}
              </li>
            );
          })}</ul>
        )
      ) : (
        !data.history.length ? <div className="card p-10 text-center text-muted">Zatím nic.</div> : (
          <ul className="space-y-3">{data.history.map((h) => (
            <li key={h.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="badge bg-surface-2">{TYPE[h.targetType]}</span>
                <span className={`badge ${h.status === 'RESOLVED' ? 'bg-brand-soft text-brand-ink' : 'bg-surface-2'}`}>{h.status === 'RESOLVED' ? 'Vyřízeno' : 'Zamítnuto'}</span>
                <span className="text-muted">{h.resolvedBy?.name ?? '—'} · {h.resolvedAt ? new Date(h.resolvedAt).toLocaleString('cs-CZ') : ''}</span>
              </div>
              <TargetView t={h} />
              <p className="text-sm"><span className="font-medium text-danger">{h.reason}</span> <span className="text-muted">– nahlásil(a) {h.reporter.name}, {ago(h.createdAt)}</span></p>
              {h.note && <p className="text-sm text-muted">„{h.note}“</p>}
              {h.resolutionNote && <p className="text-sm"><span className="text-muted">Poznámka moderátora:</span> {h.resolutionNote}</p>}
            </li>
          ))}</ul>
        )
      )}
      {dialog}
    </div>
  );
}
