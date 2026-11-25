import { ROLE_LABEL, Role } from '@dej/shared';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';

type A = { id: string; action: string; targetType: string; targetId: string; meta: Record<string, unknown> | null; createdAt: string; actor: { name: string; email: string; role: Role } };
const ACTIONS: Record<string, string> = {
  'listing.approve': 'Schválení inzerátu', 'listing.reject': 'Zamítnutí inzerátu', 'listing.delete': 'Smazání inzerátu', 'listing.staff_edit': 'Úprava cizího inzerátu', 'listing.promote': 'Přidělení propagace',
  'report.resolved': 'Vyřízení nahlášení', 'report.dismissed': 'Zamítnutí nahlášení', 'user.role': 'Změna role', 'user.block': 'Zablokování účtu', 'user.unblock': 'Odblokování účtu',
  'user.restrict': 'Omezení účtu', 'user.lift_restriction': 'Zrušení omezení', 'user.resend_verification': 'Nový ověřovací e-mail', 'business.update': 'Úprava firmy', 'business.verify_ares': 'Ověření firmy v ARES',
  'category.create': 'Nová kategorie', 'category.update': 'Úprava kategorie', 'category.move': 'Přesun kategorie', 'category.reorder': 'Pořadí kategorie', 'category.delete': 'Smazání kategorie',
  'price.create': 'Nová služba', 'price.update': 'Úprava ceníku', 'page.create': 'Nová stránka', 'page.update': 'Úprava stránky', 'page.delete': 'Smazání stránky', 'settings.update': 'Změna nastavení', 'search.reindex': 'Přeindexování',
};

export default async function Page({ searchParams }: { searchParams: Promise<{ akce?: string; cil?: string }> }) {
  if (!(await access('audit.read')).ok) return <NoAccess />;
  const { akce = '', cil = '' } = await searchParams;
  const rows = await api<A[]>(`/admin/audit?action=${encodeURIComponent(akce)}&targetId=${encodeURIComponent(cil)}`);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display text-3xl font-bold">Auditní log</h1>
        <form className="flex w-full gap-2 sm:w-auto">
          <select name="akce" defaultValue={akce} aria-label="Typ akce" className="input h-9 text-sm"><option value="">Všechny akce</option>{['listing', 'report', 'user', 'business', 'category', 'price', 'page', 'settings'].map((p) => <option key={p} value={p}>{{ listing: 'Inzeráty', report: 'Nahlášení', user: 'Uživatelé', business: 'Firmy', category: 'Kategorie', price: 'Ceník', page: 'Stránky', settings: 'Nastavení' }[p]}</option>)}</select>
          <input name="cil" defaultValue={cil} placeholder="ID cíle" aria-label="ID cíle" className="input h-9 w-32 text-sm" />
          <button className="btn btn-outline btn-sm h-9">Filtrovat</button>
        </form>
      </div>
      <ul className="card divide-y divide-line">
        {rows.map((r) => {
          const reason = typeof r.meta?.reason === 'string' ? r.meta.reason : null;
          const { reason: _r, ...rest } = r.meta ?? {};
          return (
            <li key={r.id} className="space-y-1 p-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{ACTIONS[r.action] ?? r.action}</span><span className="text-muted">{r.actor.name} ({ROLE_LABEL[r.actor.role] ?? r.actor.role}) · {new Date(r.createdAt).toLocaleString('cs-CZ')}</span></div>
              <div className="font-mono text-xs text-muted">{r.targetType}/{r.targetId}</div>
              {reason && <p>Důvod: {reason}</p>}
              {Object.keys(rest).length > 0 && <details className="text-xs"><summary className="cursor-pointer text-muted">Podrobnosti</summary><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2 p-2">{JSON.stringify(rest, null, 2)}</pre></details>}
            </li>
          );
        })}
        {!rows.length && <li className="p-8 text-center text-muted">Zatím žádné záznamy.</li>}
      </ul>
    </div>
  );
}
