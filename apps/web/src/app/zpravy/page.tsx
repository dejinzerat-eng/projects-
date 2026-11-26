import Link from 'next/link';
import { ConversationList, type ConvItem } from '@/components/conversation-list';
import { MessageSettings } from '@/components/messages/message-settings';
import { authApi } from '@/lib/api';

export default async function Page({ searchParams }: { searchParams: Promise<{ archiv?: string }> }) {
  const archived = (await searchParams).archiv === '1';
  const items = await authApi<ConvItem[]>(`/conversations${archived ? '?archived=1' : ''}`, '/zpravy');
  return (
    <div className="container-x py-6 sm:py-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h1 className="h-display text-3xl font-bold">Zprávy</h1>
        <MessageSettings />
      </div>
      <nav className="mb-4 flex gap-2" aria-label="Složky zpráv">
        <Link href="/zpravy" className={`chip ${archived ? '' : 'chip-active'}`} aria-current={archived ? undefined : 'page'}>Aktivní</Link>
        <Link href="/zpravy?archiv=1" className={`chip ${archived ? 'chip-active' : ''}`} aria-current={archived ? 'page' : undefined}>Archiv</Link>
      </nav>
      <div className="card overflow-hidden"><ConversationList items={items} archived={archived} /></div>
    </div>
  );
}
