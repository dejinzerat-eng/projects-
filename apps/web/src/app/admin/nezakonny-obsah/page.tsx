import Link from 'next/link';
import { AppealsList, NoticesList, type Appeal, type Notice } from '@/components/admin/notices';
import { api } from '@/lib/api';

type Stats = { year: number; total: number; byCategory: Record<string, number>; byStatus: Record<string, number>; decided: number; medianHours: number | null; appeals: number; appealsUpheld: number; categories: Record<string, string> };
const TABS = [
  ['RECEIVED', 'Čekající'], ['ACTION_TAKEN', 'Obsah omezen'], ['NO_ACTION', 'Bez zásahu'], ['ALL', 'Vše'],
  ['namitky', 'Námitky'], ['namitky-vyrizene', 'Vyřízené námitky'],
] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ stav?: string }> }) {
  const stav = (await searchParams).stav ?? 'RECEIVED';
  const appeals = stav.startsWith('namitky');
  const [rows, stats] = await Promise.all([
    appeals ? api<Appeal[]>(`/admin/appeals?status=${stav === 'namitky' ? 'OPEN' : 'ALL'}`) : api<Notice[]>(`/admin/notices?status=${stav}`),
    api<Stats>('/admin/notices/stats'),
  ]);
  return (
    <div>
      <h1 className="h-display text-3xl font-bold">Nezákonný obsah (DSA)</h1>
      <p className="mt-1 text-sm text-muted">Oznámení podaná přes <Link href="/nahlasit-obsah" className="underline" target="_blank">veřejný formulář</Link> a námitky autorů proti rozhodnutí moderace.</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [`Oznámení ${stats.year}`, stats.total], ['Čeká na posouzení', stats.byStatus.RECEIVED ?? 0],
          ['Medián vyřízení', stats.medianHours == null ? '–' : `${stats.medianHours} h`], ['Námitky (vyhověno)', `${stats.appeals} (${stats.appealsUpheld})`],
        ].map(([k, v]) => <div key={k} className="card p-4"><dt className="text-xs text-muted">{k}</dt><dd className="mt-1 text-xl font-bold">{v}</dd></div>)}
      </dl>
      {stats.total > 0 && <p className="mt-3 text-xs text-muted">Podle druhu: {Object.entries(stats.byCategory).map(([k, v]) => `${stats.categories[k] ?? k} ${v}`).join(' · ')}</p>}
      <nav className="mt-6 flex gap-1.5 overflow-x-auto scrollbar-none pb-1" aria-label="Filtr">
        {TABS.map(([k, label]) => <Link key={k} href={`/admin/nezakonny-obsah?stav=${k}`} className={`chip shrink-0 ${stav === k ? 'chip-active' : ''}`}>{label}</Link>)}
      </nav>
      <div className="mt-4">{appeals ? <AppealsList rows={rows as Appeal[]} /> : <NoticesList rows={rows as Notice[]} />}</div>
    </div>
  );
}
