import Link from 'next/link';
import { UsersTable } from '@/components/admin/users';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';

const FILTERS = [['ALL', 'Všichni'], ['RESTRICTED', 'Omezení'], ['BLOCKED', 'Zablokovaní'], ['STAFF', 'Tým']] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; stav?: string }> }) {
  const { ok, perms, me } = await access('users.read');
  if (!ok || !me) return <NoAccess />;
  const { q = '', stav = 'ALL' } = await searchParams;
  const rows = await api<any[]>(`/admin/users?q=${encodeURIComponent(q)}&stav=${encodeURIComponent(stav)}`);
  return (
    <div>
      <h1 className="h-display mb-4 text-3xl font-bold">Uživatelé</h1>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {FILTERS.map(([k, l]) => <Link key={k} href={`?stav=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={`chip ${stav === k ? 'chip-active' : ''}`}>{l}</Link>)}
        <form className="w-full sm:ml-auto sm:w-auto"><input type="hidden" name="stav" value={stav} /><input name="q" defaultValue={q} placeholder="Hledat e-mail, jméno, IČO" aria-label="Hledat uživatele" className="input h-9 w-full text-sm sm:w-64" /></form>
      </div>
      <UsersTable rows={rows} perms={perms} meId={me.id} />
    </div>
  );
}
