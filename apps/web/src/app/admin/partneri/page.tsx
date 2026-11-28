import Link from 'next/link';
import { Plus } from 'lucide-react';
import { StatusBadge } from '@/components/admin/partners';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { access, NoAccess } from '../_access';

interface Row {
  id: string; name: string; url: string; active: boolean; intervalHours: number; lastSyncAt: string | null; lastStatus: string | null; lastMessage: string | null; nextSyncAt: string | null;
  user: { id: string; email: string; name: string; companyName: string | null }; counts: Record<string, number>;
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

export default async function Page() {
  if (!(await access('businesses.manage')).ok) return <NoAccess />;
  const rows = await api<Row[]>('/admin/feeds');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="h-display text-3xl font-bold">Partneři a XML import</h1>
          <p className="mt-1 text-muted">Bezplatný automatický import nabídek autobazarů, realitních kanceláří a e-shopů z jejich XML feedu (Heureka/Zboží, Google Nákupy nebo vlastní export).</p>
        </div>
        <Link href="/admin/partneri/novy" className="btn btn-primary"><Plus className="size-4" />Přidat partnera</Link>
      </div>
      {rows.length ? (
        <ul className="card divide-y divide-line">
          {rows.map((f) => (
            <li key={f.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/partneri/${f.id}`} className="font-semibold hover:underline">{f.name}</Link>
                  <StatusBadge status={f.lastStatus} />
                  {!f.active && <span className="badge bg-surface-2">Pozastaveno</span>}
                </div>
                <div className="text-sm text-muted">{f.user.companyName ?? f.user.name} · {f.user.email} · {host(f.url)}</div>
                <div className="text-xs text-muted">
                  {(f.counts.ACTIVE ?? 0) + (f.counts.RESERVED ?? 0)} zveřejněných{f.counts.PENDING ? ` · ${f.counts.PENDING} ke schválení` : ''}{f.counts.EXPIRED ? ` · ${f.counts.EXPIRED} stažených` : ''}
                  {' · '}{f.lastSyncAt ? `synchronizace ${ago(f.lastSyncAt)}` : 'zatím nesynchronizováno'}{f.active && f.intervalHours === 0 ? ' · jen ručně' : ''}
                </div>
                {f.lastStatus === 'error' && f.lastMessage && <div className="mt-0.5 text-xs text-danger">{f.lastMessage}</div>}
              </div>
              <Link href={`/admin/partneri/${f.id}`} className="btn btn-outline btn-sm self-start sm:self-center">Otevřít</Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card space-y-2 p-10 text-center">
          <p className="font-medium">Zatím žádní partneři.</p>
          <p className="text-sm text-muted">Přidejte prvního – stačí adresa jeho XML feedu a e-mail. Postup je v dokumentaci docs/XML-IMPORT-PARTNERU.md.</p>
        </div>
      )}
    </div>
  );
}
