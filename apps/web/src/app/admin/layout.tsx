import { notFound, redirect } from 'next/navigation';
import { can, permissionsOf, ROLE_LABEL } from '@dej/shared';
import { AdminNav } from '@/components/admin/nav';
import { getMe } from '@/lib/api';
export const metadata = { title: 'Administrace', robots: { index: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/prihlaseni?zpet=/admin');
  if (!can(me.role, 'admin.access')) notFound();
  return (
    <div className="container-x py-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:gap-8">
        <AdminNav perms={permissionsOf(me.role)} roleLabel={ROLE_LABEL[me.role]} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
