import { MarkRead, NotificationRow, type NotificationItem } from '@/components/account-lists';
import { authApi } from '@/lib/api';
export const metadata = { title: 'Upozornění', robots: { index: false } };
export default async function Page() {
  const items = await authApi<NotificationItem[]>('/me/notifications', '/muj-ucet/upozorneni');
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3"><h1 className="h-display text-3xl font-bold">Upozornění</h1>{items.some((i) => !i.readAt) && <MarkRead />}</div>
      {!items.length ? <div className="card p-12 text-center text-muted">Zatím žádná upozornění.</div> : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((n) => (
            <li key={n.id}><NotificationRow n={n} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}
