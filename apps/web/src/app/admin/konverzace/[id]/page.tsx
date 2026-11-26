import { notFound } from 'next/navigation';
import { AdminConversation, type AdminConv } from '@/components/messages/admin-conversation';
import { api, getMe } from '@/lib/api';
export const metadata = { title: 'Nahlášená konverzace', robots: { index: false } };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, c] = await Promise.all([getMe(), api<AdminConv>(`/admin/conversations/${id}`).catch(() => null)]);
  if (!c || !me) notFound();
  return <AdminConversation c={c} isAdmin={me.role === 'ADMIN'} />;
}
