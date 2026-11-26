import { AccountNav } from '@/components/account-nav';
import { getMe, redirectToLogin } from '@/lib/api';

export const metadata = { robots: { index: false, follow: false } };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) return redirectToLogin('/muj-ucet/inzeraty');
  return (
    <div className="container-x py-6 sm:py-10">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <AccountNav unread={me.unreadNotifications} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
