import { notFound } from 'next/navigation';
import { ConversationList, type ConvItem } from '@/components/conversation-list';
import { Thread, type ThreadData } from '@/components/thread';
import { api, getMe } from '@/lib/api';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [me, t] = await Promise.all([getMe(), api<ThreadData>(`/conversations/${id}`).catch(() => null)]);
  if (!t || !me) notFound();
  const list = await api<ConvItem[]>(`/conversations${t.archived ? '?archived=1' : ''}`).catch(() => []);
  return (
    <div className="container-x py-0 sm:py-6">
      <div className="grid overflow-hidden sm:card lg:grid-cols-[340px_1fr]">
        <aside className="hidden max-h-[calc(100dvh-10rem)] overflow-y-auto border-r border-line lg:block" aria-label={t.archived ? 'Archiv konverzací' : 'Konverzace'}><ConversationList items={list} activeId={id} archived={t.archived} /></aside>
        <Thread key={t.id} initial={t} meId={me.id} />
      </div>
    </div>
  );
}
