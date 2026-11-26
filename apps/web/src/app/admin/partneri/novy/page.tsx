import Link from 'next/link';
import { NewPartner, type FeedMeta } from '@/components/admin/partners';
import { api } from '@/lib/api';
import { access, NoAccess } from '../../_access';

export default async function Page() {
  if (!(await access('businesses.manage')).ok) return <NoAccess />;
  const meta = await api<FeedMeta>('/admin/feeds/meta');
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/partneri" className="text-sm text-muted hover:underline">← Partneři a XML import</Link>
        <h1 className="h-display mt-1 text-3xl font-bold">Nový partner</h1>
        <p className="mt-1 text-muted">Zadejte adresu XML feedu partnera a jeho e-mail. Náhled ukáže, jak se nabídky převedou, ještě než cokoli uložíte.</p>
      </div>
      <NewPartner meta={meta} />
    </div>
  );
}
