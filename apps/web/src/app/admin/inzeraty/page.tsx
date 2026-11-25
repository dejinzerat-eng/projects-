import { Suspense } from 'react';
import { ModerationList } from '@/components/admin/moderation';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';
export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { ok, perms } = await access('listings.read');
  if (!ok) return <NoAccess />;
  const { status = 'PENDING', q = '' } = await searchParams;
  const rows = await api<any[]>(`/admin/listings?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`);
  return <div><h1 className="h-display mb-5 text-3xl font-bold">Inzeráty</h1><Suspense><ModerationList rows={rows} perms={perms} /></Suspense></div>;
}
