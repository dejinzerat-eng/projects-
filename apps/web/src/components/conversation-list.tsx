import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { ago, price } from '@/lib/format';
import { Avatar } from './avatar';

export interface ConvItem { id: string; listing: { id: string; title: string; price: number | null; priceNegotiable: boolean; status: string; image: string | null } | null; other: { id: string; name: string; avatarUrl: string | null }; role: string; lastMessage: { body: string; imageUrl: string | null; createdAt: string; senderId: string } | null; unread: number; lastMessageAt: string; archived?: boolean }

export function ConversationList({ items, activeId, archived }: { items: ConvItem[]; activeId?: string; archived?: boolean }) {
  if (!items.length) return <div className="p-8 text-center text-muted">{archived ? 'V archivu nemáte žádné konverzace.' : 'Zatím nemáte žádné zprávy. Napište prodejci přímo z detailu inzerátu nebo z jeho profilu.'}</div>;
  return (
    <ul className="divide-y divide-line">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/zpravy/${c.id}`} className={`flex gap-3 p-4 transition hover:bg-surface-2 ${c.id === activeId ? 'bg-surface-2' : ''}`}>
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {c.listing?.image ? <img src={c.listing.image} alt="" className="size-14 rounded-xl object-cover" /> : <div className="grid size-14 place-items-center rounded-xl bg-surface-2 text-muted">{!c.listing && <MessageCircle className="size-6" aria-hidden />}</div>}
              <span className="absolute -bottom-1 -right-1 rounded-full ring-2 ring-surface"><Avatar name={c.other.name} url={c.other.avatarUrl} size={24} /></span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2"><span className={`truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{c.other.name}</span><span className="shrink-0 text-xs text-muted">{ago(c.lastMessageAt)}</span></div>
              <div className="truncate text-sm text-ink-2">{c.listing ? `${c.listing.title} · ${price(c.listing.price, c.listing.priceNegotiable)}` : 'Zpráva z profilu'}</div>
              <div className="flex items-center gap-2"><span className={`truncate text-sm ${c.unread ? 'font-semibold text-ink' : 'text-muted'}`}>{c.lastMessage?.body || (c.lastMessage?.imageUrl ? '📷 Fotka' : '')}</span>{c.unread > 0 && <span className="ml-auto shrink-0 rounded-full bg-brand px-1.5 text-xs font-bold text-white">{c.unread}</span>}</div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
