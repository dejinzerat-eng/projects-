'use client';
import { Flag } from 'lucide-react';
import { useState } from 'react';
import { call } from '@/lib/client';
import { useToast } from '../toast';

const REASONS = ['Žádá platbu předem nebo mimo portál', 'Podvodný odkaz', 'Obtěžování nebo urážky', 'Spam nebo reklama', 'Jiný důvod'];

/** Nahlášení konverzace nebo jedné zprávy. Moderátor pak konverzaci uvidí jen ke čtení. */
export function ChatReport({ kind, id, otherName, onBlocked, compact }: { kind: 'conversation' | 'message'; id: string; otherName: string; onBlocked?: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const [block, setBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const title = kind === 'conversation' ? 'Nahlásit konverzaci' : 'Nahlásit zprávu';

  async function submit() {
    setBusy(true);
    try {
      await call(kind === 'conversation' ? `/conversations/${id}/report` : `/messages/${id}/report`, 'POST', { reason, note: note.trim() || undefined });
      if (block) onBlocked?.();
      setOpen(false); setNote('');
      toast('Děkujeme, moderátoři se na to podívají.');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  return (
    <>
      {compact
        ? <button type="button" onClick={() => setOpen(true)} className="text-[11px] text-muted underline-offset-2 hover:text-danger hover:underline">Nahlásit</button>
        : <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm px-2 sm:px-3" aria-label={title} title={title}><Flag className="size-4" /><span className="hidden sm:inline">Nahlásit</span></button>}
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-end text-left text-[15px] font-normal leading-normal text-ink sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby={`rep-${id}`}>
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="animate-fade-up relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-6 sm:rounded-3xl">
            <h2 id={`rep-${id}`} className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-muted">Moderátor uvidí tuto konverzaci, aby mohl posoudit, co se stalo.</p>
            <div className="mt-4 space-y-2">
              {REASONS.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-ink">
                  <input type="radio" name={`reason-${id}`} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--brand)]" />{r}
                </label>
              ))}
            </div>
            <textarea className="input mt-3 h-auto py-2.5" rows={3} maxLength={1000} placeholder="Co se stalo? (nepovinné)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Doplňující informace" />
            {onBlocked && <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} className="size-4 accent-[var(--brand)]" />Zároveň zablokovat uživatele {otherName}</label>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">Zrušit</button>
              <button type="button" onClick={submit} disabled={busy} className="btn btn-dark">Odeslat</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
