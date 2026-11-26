import Link from 'next/link';
import { ROLE_LABEL, Role } from '@dej/shared';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';

type A = { id: string; action: string; targetType: string; targetId: string; meta: Record<string, unknown> | null; createdAt: string; actor: { id: string; name: string; email: string; role: Role } };
const ACTIONS: Record<string, string> = {
  'listing.approve': 'Schválení inzerátu', 'listing.reject': 'Zamítnutí inzerátu', 'listing.delete': 'Smazání inzerátu', 'listing.staff_edit': 'Úprava cizího inzerátu', 'listing.promote': 'Přidělení propagace', 'listing.reinstate': 'Obnovení inzerátu po námitce',
  'report.resolved': 'Vyřízení nahlášení', 'report.dismissed': 'Zamítnutí nahlášení', 'report.view_conversation': 'Zobrazení nahlášené konverzace', 'user.role': 'Změna role', 'user.block': 'Zablokování účtu', 'user.unblock': 'Odblokování účtu',
  'user.restrict': 'Omezení účtu', 'user.lift_restriction': 'Zrušení omezení', 'user.resend_verification': 'Nový ověřovací e-mail', 'business.update': 'Úprava firmy', 'business.verify': 'Ruční ověření firmy', 'business.unverify': 'Zrušení ověření firmy', 'business.verify_ares': 'Ověření firmy v ARES',
  'category.create': 'Nová kategorie', 'category.update': 'Úprava kategorie', 'category.move': 'Přesun kategorie', 'category.reorder': 'Pořadí kategorie', 'category.delete': 'Smazání kategorie', 'category.intro': 'Úvodní text kategorie',
  'price.create': 'Nová služba', 'price.update': 'Úprava ceníku', 'page.create': 'Nová stránka', 'page.update': 'Úprava stránky', 'page.delete': 'Smazání stránky', 'page.meta': 'Metadata stránky', 'settings.update': 'Změna nastavení', 'search.reindex': 'Přeindexování',
  'redirect.save': 'Uložení přesměrování', 'redirect.delete': 'Smazání přesměrování', 'seo.home': 'SEO úvodní stránky', 'notice.action_taken': 'Oznámení DSA – zásah', 'notice.no_action': 'Oznámení DSA – bez zásahu', 'appeal.upheld': 'Námitce vyhověno', 'appeal.rejected': 'Námitka zamítnuta',
  'auth.session_revoke': 'Odhlášení zařízení', 'auth.sessions_revoke_all': 'Odhlášení všech zařízení', 'account.gdpr_export': 'Export osobních údajů', 'account.delete': 'Smazání účtu',
};
const GROUPS: [string, string][] = [['listing', 'Inzeráty'], ['report', 'Nahlášení'], ['user', 'Uživatelé'], ['business', 'Firmy'], ['category', 'Kategorie'], ['price', 'Ceník'], ['page', 'Stránky'], ['redirect', 'Přesměrování'], ['settings', 'Nastavení'], ['notice', 'Oznámení DSA'], ['appeal', 'Námitky'], ['auth', 'Přihlášení'], ['account', 'Účty uživatelů']];
const TYPES: [string, string][] = [['listing', 'Inzerát'], ['user', 'Uživatel'], ['category', 'Kategorie'], ['price', 'Služba ceníku'], ['page', 'Stránka'], ['seo', 'SEO'], ['settings', 'Nastavení'], ['report', 'Nahlášení'], ['conversation', 'Konverzace'], ['notice', 'Oznámení DSA'], ['appeal', 'Námitka']];

type SP = { akce?: string; kdo?: string; typ?: string; cil?: string; od?: string; do?: string; po?: string };

/** Odkaz na detail cíle v administraci (kde existuje). */
function targetHref(type: string, id: string) {
  const t = type.toLowerCase();
  if (t === 'listing') return `/admin/inzeraty?status=ALL&q=${encodeURIComponent(id)}`;
  if (t === 'user') return `/admin/uzivatele?q=${encodeURIComponent(id)}`;
  if (t === 'conversation') return `/admin/konverzace/${encodeURIComponent(id)}`;
  return null;
}

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  if (!(await access('audit.read')).ok) return <NoAccess />;
  const sp = await searchParams;
  const f = { akce: sp.akce ?? '', kdo: sp.kdo ?? '', typ: sp.typ ?? '', cil: sp.cil ?? '', od: sp.od ?? '', do: sp.do ?? '' };
  const qs = new URLSearchParams({ action: f.akce, actor: f.kdo, targetType: f.typ, targetId: f.cil, from: f.od, to: f.do, cursor: sp.po ?? '' });
  const { items: rows, nextCursor } = await api<{ items: A[]; nextCursor: string | null }>(`/admin/audit?${qs}`);
  const filtered = Object.values(f).some(Boolean);
  const keep = (extra: Record<string, string>) => `?${new URLSearchParams(Object.fromEntries(Object.entries({ ...f, ...extra }).filter(([, v]) => v)))}`;
  return (
    <div>
      <h1 className="h-display mb-4 text-3xl font-bold">Auditní log</h1>
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className="label text-xs" htmlFor="a-akce">Akce</label><select id="a-akce" name="akce" defaultValue={f.akce} className="input h-9 text-sm"><option value="">Všechny akce</option>{GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}{f.akce && !GROUPS.some(([k]) => k === f.akce) && <option value={f.akce}>{ACTIONS[f.akce] ?? f.akce}</option>}</select></div>
        <div><label className="label text-xs" htmlFor="a-kdo">Kdo</label><input id="a-kdo" name="kdo" defaultValue={f.kdo} placeholder="Jméno, e-mail nebo ID" className="input h-9 text-sm" /></div>
        <div className="grid grid-cols-[1fr_1.4fr] gap-2">
          <div><label className="label text-xs" htmlFor="a-typ">Cíl</label><select id="a-typ" name="typ" defaultValue={f.typ} className="input h-9 text-sm"><option value="">Vše</option>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label className="label text-xs" htmlFor="a-cil">ID cíle</label><input id="a-cil" name="cil" defaultValue={f.cil} placeholder="ID" className="input h-9 text-sm" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label text-xs" htmlFor="a-od">Od</label><input id="a-od" name="od" type="date" defaultValue={f.od} className="input h-9 text-sm" /></div>
          <div><label className="label text-xs" htmlFor="a-do">Do</label><input id="a-do" name="do" type="date" defaultValue={f.do} className="input h-9 text-sm" /></div>
        </div>
        <div className="flex items-end gap-2 lg:col-span-2">
          <button className="btn btn-dark btn-sm">Filtrovat</button>
          {filtered && <Link href="/admin/audit" className="btn btn-ghost btn-sm">Zrušit filtry</Link>}
        </div>
      </form>
      <ul className="card divide-y divide-line">
        {rows.map((r) => {
          const reason = typeof r.meta?.reason === 'string' ? r.meta.reason : null;
          const { reason: _r, ...rest } = r.meta ?? {};
          const href = targetHref(r.targetType, r.targetId);
          return (
            <li key={r.id} className="space-y-1 p-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{ACTIONS[r.action] ?? r.action}</span><span className="text-muted"><Link href={keep({ kdo: r.actor.id })} className="hover:underline">{r.actor.name}</Link> ({ROLE_LABEL[r.actor.role] ?? r.actor.role}) · {new Date(r.createdAt).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })}</span></div>
              <div className="flex flex-wrap gap-x-3 font-mono text-xs text-muted">
                <Link href={keep({ typ: r.targetType, cil: r.targetId })} className="break-all hover:underline" title="Jen záznamy k tomuto cíli">{r.targetType}/{r.targetId}</Link>
                {href && <Link href={href} className="font-sans underline">Otevřít</Link>}
              </div>
              {reason && <p>Důvod: {reason}</p>}
              {Object.keys(rest).length > 0 && <details className="text-xs"><summary className="cursor-pointer text-muted">Podrobnosti</summary><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-2">{JSON.stringify(rest, null, 2)}</pre></details>}
            </li>
          );
        })}
        {!rows.length && <li className="p-8 text-center text-muted">{filtered ? 'Žádné záznamy neodpovídají filtrům.' : 'Zatím žádné záznamy.'}</li>}
      </ul>
      {(nextCursor || sp.po) && (
        <div className="mt-4 flex justify-between gap-2">
          {sp.po ? <Link href={keep({})} className="btn btn-ghost btn-sm">Na nejnovější</Link> : <span />}
          {nextCursor && <Link href={keep({ po: nextCursor })} className="btn btn-outline btn-sm">Starší záznamy</Link>}
        </div>
      )}
    </div>
  );
}
