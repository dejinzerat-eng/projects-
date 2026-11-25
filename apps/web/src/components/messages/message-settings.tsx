'use client';
import { useEffect, useState } from 'react';
import { call } from '@/lib/client';
import { useToast } from '../toast';

/** Přepínač e-mailových upozornění na nové zprávy. */
export function MessageSettings() {
  const [on, setOn] = useState<boolean | null>(null);
  const toast = useToast();
  useEffect(() => { call<{ emailOnMessage: boolean }>('/me/message-settings').then((r) => setOn(r.emailOnMessage)).catch(() => setOn(true)); }, []);
  async function toggle(v: boolean) {
    setOn(v);
    try { await call('/me/message-settings', 'PUT', { emailOnMessage: v }); toast(v ? 'E-maily o nových zprávách zapnuty' : 'E-maily o nových zprávách vypnuty'); }
    catch (e) { setOn(!v); toast((e as Error).message, 'error'); }
  }
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={on ?? true} disabled={on === null} onChange={(e) => toggle(e.target.checked)} />
      Posílat e-mail o nových zprávách
    </label>
  );
}
