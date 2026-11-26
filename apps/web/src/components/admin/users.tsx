'use client';
import Link from 'next/link';
import { useState } from 'react';
import { isAdminRole, Permission, Role, ROLE_LABEL, ROLES } from '@dej/shared';
import { call } from '@/lib/client';
import { ago, listingUrl, STATUS_LABEL } from '@/lib/format';
import { useAct, useReasonDialog } from './dialog';

interface U {
  id: string; email: string; name: string; role: Role; status: 'ACTIVE' | 'BLOCKED' | 'RESTRICTED'; createdAt: string; lastActiveAt: string | null;
  phoneVerifiedAt: string | null; emailVerifiedAt: string | null; isBusiness: boolean; companyName: string | null;
  _count: { listings: number; reports: number }; restriction: { reason: string; source: string; createdAt: string } | null;
}
interface Detail {
  listings: { id: string; slug: string; title: string; status: string; spamScore: number; createdAt: string }[];
  restrictions: { id: string; source: string; reason: string; createdAt: string; liftedAt: string | null; liftNote: string | null }[];
  activeSessions: number; reportsAgainst: number; reporters7: number; phone: string | null; city: string | null;
}

const STATUS = { ACTIVE: 'Aktivní', BLOCKED: 'Zablokovaný', RESTRICTED: 'Omezený' };

export function UsersTable({ rows, perms, meId }: { rows: U[]; perms: Permission[]; meId: string }) {
  const act = useAct(); const { ask, dialog } = useReasonDialog();
  const [open, setOpen] = useState<Record<string, Detail | 'loading'>>({});
  const can = (p: Permission) => perms.includes(p);
  const superadmin = can('admins.manage');
  const assignable = ROLES.filter((r) => superadmin || !isAdminRole(r));
  /** Stejná pravidla jako API (staff-policy.ts) – tlačítka, která by skončila chybou, se nezobrazí. */
  const mayTouch = (u: U) => u.id !== meId && (u.role === 'USER' || (can('users.manage') && (!isAdminRole(u.role) || superadmin)));

  async function status(u: U, next: U['status']) {
    const titles = { BLOCKED: `Zablokovat ${u.name}`, RESTRICTED: `Omezit ${u.name}`, ACTIVE: u.status === 'RESTRICTED' ? `Zrušit omezení ${u.name}` : `Odblokovat ${u.name}` };
    const hints = { BLOCKED: 'Účet se odhlásí a jeho aktivní inzeráty budou staženy.', RESTRICTED: 'Účet nebude moci zveřejňovat inzeráty ani psát zprávy.', ACTIVE: undefined };
    const reason = await ask({ title: titles[next], hint: hints[next], required: next !== 'ACTIVE', label: next === 'ACTIVE' ? 'Poznámka pro uživatele' : 'Důvod', confirm: next === 'ACTIVE' ? 'Potvrdit' : titles[next].split(' ')[0], danger: next !== 'ACTIVE' });
    if (reason !== null) await act(() => call(`/admin/users/${u.id}/status`, 'POST', { status: next, reason: reason || undefined }));
  }
  async function toggle(u: U) {
    if (open[u.id]) { const { [u.id]: _, ...rest } = open; setOpen(rest); return; }
    setOpen({ ...open, [u.id]: 'loading' });
    try { const d = await call<Detail>(`/admin/users/${u.id}`); setOpen((o) => ({ ...o, [u.id]: d })); } catch { setOpen((o) => { const { [u.id]: _, ...rest } = o; return rest; }); }
  }

  if (!rows.length) return <div className="card p-10 text-center text-muted">Nikoho jsme nenašli.</div>;
  return (
    <>
    <ul className="card divide-y divide-line">
      {rows.map((u) => {
        const d = open[u.id];
        return (
          <li key={u.id} className="space-y-3 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/uzivatel/${u.id}`} target="_blank" className="font-semibold hover:underline">{u.name}</Link>
                  {u.role !== 'USER' && <span className="badge bg-trust-soft text-trust">{ROLE_LABEL[u.role]}</span>}
                  {u.status !== 'ACTIVE' && <span className="badge bg-danger-soft text-danger">{STATUS[u.status]}</span>}
                  {u.isBusiness && <span className="badge bg-surface-2">Firma</span>}
                </div>
                <div className="truncate text-sm text-muted">{u.email}{u.emailVerifiedAt ? '' : ' · e-mail neověřen'}{u.phoneVerifiedAt && ' · telefon ověřen'}</div>
                <div className="text-xs text-muted">Registrace {ago(u.createdAt)} · aktivní {u.lastActiveAt ? ago(u.lastActiveAt) : 'nikdy'} · {u._count.listings} inzerátů</div>
                {u.restriction && <p className="mt-1 text-sm text-danger">Omezení ({u.restriction.source === 'auto' ? 'automaticky' : 'ručně'}, {ago(u.restriction.createdAt)}): {u.restriction.reason}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {can('users.roles') && (
                  <select aria-label={`Role uživatele ${u.name}`} className="input h-8 w-auto py-0 text-sm" value={u.role} disabled={u.id === meId || (isAdminRole(u.role) && !superadmin)}
                    onChange={(e) => act(() => call(`/admin/users/${u.id}/role`, 'PATCH', { role: e.target.value }), 'Role změněna')}>
                    {(assignable.includes(u.role) ? assignable : [u.role, ...assignable]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                )}
                {mayTouch(u) && u.status === 'ACTIVE' && !isAdminRole(u.role) && can('users.restrict') && <button onClick={() => status(u, 'RESTRICTED')} className="btn btn-outline btn-sm">Omezit</button>}
                {mayTouch(u) && u.status === 'RESTRICTED' && can('users.restrict') && <button onClick={() => status(u, 'ACTIVE')} className="btn btn-dark btn-sm">Zrušit omezení</button>}
                {mayTouch(u) && u.status !== 'BLOCKED' && can('users.block') && <button onClick={() => status(u, 'BLOCKED')} className="btn btn-danger btn-sm">Zablokovat</button>}
                {mayTouch(u) && u.status === 'BLOCKED' && can('users.unblock') && <button onClick={() => status(u, 'ACTIVE')} className="btn btn-outline btn-sm">Odblokovat</button>}
                {!u.emailVerifiedAt && can('users.resendVerification') && <button onClick={() => act(() => call(`/admin/users/${u.id}/resend-verification`, 'POST'), 'Ověřovací e-mail odeslán')} className="btn btn-ghost btn-sm">Poslat ověření</button>}
                <button onClick={() => toggle(u)} aria-expanded={!!d} className="btn btn-ghost btn-sm">{d ? 'Skrýt' : 'Detail'}</button>
              </div>
            </div>
            {d === 'loading' && <p className="text-sm text-muted">Načítám…</p>}
            {d && d !== 'loading' && (
              <div className="grid gap-4 rounded-xl bg-surface-2 p-3 text-sm sm:grid-cols-2 [&>div]:min-w-0">
                <div>
                  <p className="break-words text-muted">Telefon: {d.phone ?? '—'} · Město: {d.city ?? '—'} · Přihlášení: {d.activeSessions}</p>
                  <p className="text-muted">Nahlášení účtu: {d.reportsAgainst} · různých oznamovatelů za 7 dní: {d.reporters7}</p>
                  <h3 className="mt-2 font-semibold">Inzeráty</h3>
                  <ul className="mt-1 space-y-0.5">{d.listings.length ? d.listings.map((l) => <li key={l.id} className="truncate"><Link href={listingUrl(l)} target="_blank" className="hover:underline">{l.title}</Link> <span className="text-muted">· {STATUS_LABEL[l.status]}{l.spamScore ? ` · riziko ${l.spamScore}` : ''}</span></li>) : <li className="text-muted">Žádné</li>}</ul>
                </div>
                <div>
                  <h3 className="font-semibold">Historie omezení</h3>
                  <ul className="mt-1 space-y-1">{d.restrictions.length ? d.restrictions.map((r) => <li key={r.id}><span>{r.reason}</span> <span className="text-muted">· {r.source === 'auto' ? 'automat' : 'tým'}, {new Date(r.createdAt).toLocaleDateString('cs-CZ')}{r.liftedAt ? `, zrušeno ${new Date(r.liftedAt).toLocaleDateString('cs-CZ')}${r.liftNote ? ` (${r.liftNote})` : ''}` : ', trvá'}</span></li>) : <li className="text-muted">Bez omezení</li>}</ul>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
    {dialog}
    </>
  );
}
