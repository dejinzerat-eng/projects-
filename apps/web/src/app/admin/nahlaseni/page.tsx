import { Reports } from '@/components/admin/reports';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { ok, perms } = await access('reports.read');
  if (!ok) return <NoAccess />;
  const { status = 'OPEN' } = await searchParams;
  const data = await api<any>(`/admin/reports?status=${encodeURIComponent(status)}`);
  return <div><h1 className="h-display mb-5 text-3xl font-bold">Nahlášený obsah</h1><Reports data={data} perms={perms} /></div>;
}
