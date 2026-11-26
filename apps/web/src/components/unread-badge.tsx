'use client';
import { useUnread, type Unread } from '@/lib/unread';

/** Číslo na ikoně v hlavičce – průběžně se obnovuje (viz useUnread). */
export function UnreadBadge({ initial, kind, className }: { initial: Unread; kind: keyof Unread; className: string }) {
  const n = useUnread(initial)[kind];
  return n ? <span className={className}>{n}</span> : null;
}
