'use client';
import { Loader2, Mail, Send, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { call } from '@/lib/client';
import { useToast } from '../toast';

export function MessageUserDialog({ userId, name, loggedIn }: { userId: string; name: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter(); const toast = useToast();

  function start() {
    if (!loggedIn) return router.push(`/prihlaseni?zpet=${encodeURIComponent(location.pathname)}`);
    setOpen(true);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const r = await call<{ conversationId: string }>(`/users/${userId}/message`, 'POST', { body });
      router.push(`/zpravy/${r.conversationId}`);
    } catch (err) { toast((err as Error).message, 'error'); setBusy(false); }
  }

  return (
    <>
      <button type="button" onClick={start} className="btn btn-primary w-full"><Mail className="size-4" />Napsat zprávu</button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="msg-user-t">
          <div className="absolute inset-0 bg-ink/40" onClick={() => !busy && setOpen(false)} />
          <form onSubmit={send} className="animate-fade-up relative w-full max-w-md rounded-t-3xl bg-surface p-6 sm:rounded-3xl" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
            <h2 id="msg-user-t" className="text-lg font-bold">Napsat zprávu</h2>
            <p className="mt-0.5 text-sm text-muted">Komu: <span className="font-semibold text-ink">{name}</span></p>
            <label htmlFor="msg-user-body" className="sr-only">Text zprávy</label>
            <textarea id="msg-user-body" autoFocus className="input mt-4 h-auto min-h-28 py-2.5" rows={4} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Dobrý den, …" />
            <p className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-muted"><ShieldCheck className="mt-px size-4 shrink-0 text-trust" aria-hidden />Váš e-mail ani telefon neukazujeme. Konverzaci najdete ve Zprávách.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn btn-ghost">Zrušit</button>
              <button className="btn btn-primary" disabled={busy || !body.trim()}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Odeslat</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
