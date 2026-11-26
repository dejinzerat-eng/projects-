import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PartnerDetail, type FeedDetail, type FeedMeta } from '@/components/admin/partners';
import { api, ApiError } from '@/lib/api';
import { access, NoAccess } from '../../_access';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  if (!(await access('businesses.manage')).ok) return <NoAccess />;
  const { id } = await params;
  const [feed, meta] = await Promise.all([
    api<FeedDetail>(`/admin/feeds/${encodeURIComponent(id)}`).catch((e) => { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }),
    api<FeedMeta>('/admin/feeds/meta'),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/partneri" className="text-sm text-muted hover:underline">← Partneři a XML import</Link>
        <h1 className="h-display mt-1 text-3xl font-bold">{feed.name}</h1>
        <p className="mt-1 break-all text-sm text-muted">{feed.url}</p>
      </div>
      <PartnerDetail key={feed.id} feed={feed} meta={meta} />
    </div>
  );
}
