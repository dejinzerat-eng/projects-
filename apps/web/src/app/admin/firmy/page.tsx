import Link from 'next/link';
import { BusinessesTable } from '@/components/admin/businesses';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; overeni?: string }> }) {
  if (!(await access('businesses.manage')).ok) return <NoAccess />;
  const { q = '', overeni = '' } = await searchParams;
  const rows = await api<any[]>(`/admin/businesses?q=${encodeURIComponent(q)}&overeni=${encodeURIComponent(overeni)}`);
  return (
    <div>
      <h1 className="h-display mb-4 text-3xl font-bold">Firemní účty</h1>
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {[['', 'Všechny'], ['ne', 'Neověřené'], ['ano', 'Ověřené']].map(([k, l]) => <Link key={k} href={`?overeni=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className={`chip ${overeni === k ? 'chip-active' : ''}`}>{l}</Link>)}
        <form className="w-full sm:ml-auto sm:w-auto"><input type="hidden" name="overeni" value={overeni} /><input name="q" defaultValue={q} placeholder="Název, IČO, e-mail" aria-label="Hledat firmy" className="input h-9 w-full text-sm sm:w-64" /></form>
      </div>
      <BusinessesTable rows={rows} />
    </div>
  );
}
