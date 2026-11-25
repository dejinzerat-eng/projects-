'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, Ban, ImagePlus, Loader2, Send, ShieldCheck, Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { call } from '@/lib/client';
import { shrinkImage } from '@/lib/image';
import { listingUrl, price, STATUS_LABEL } from '@/lib/format';
import { Avatar } from './avatar';
import { ChatReport } from './messages/chat-report';
import { MessageWarning, type MessageWarningData } from './messages/message-warning';
import { useToast } from './toast';

interface Msg { id: string; senderId: string; body: string; imageUrl: string | null; createdAt: string; readAt: string | null; warning: MessageWarningData | null }
export interface ThreadData {
  id: string; listing: { id: string; slug: string; title: string; price: number | null; priceNegotiable: boolean; status: string; image: string | null } | null;
  other: { id: string; name: string; avatarUrl: string | null; phoneVerifiedAt: string | null }; role: string; messages: Msg[];
  iBlocked: boolean; blocked: boolean; archived: boolean; photos: boolean; canReview: boolean; myReview: { rating: number } | null;
}

export function Thread({ initial, meId }: { initial: ThreadData; meId: string }) {
  const [t, setT] = useState(initial);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const toast = useToast(); const router = useRouter();
  const refresh = useCallback(() => call<ThreadData>(`/conversations/${t.id}`).then(setT).catch(() => {}), [t.id]);

  // jednoduchý polling, jen když je stránka vidět (fáze 2: WebSocket)
  useEffect(() => { const i = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 5000); return () => clearInterval(i); }, [refresh]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [t.messages.length]);

  async function send(payload: { body: string; attachmentId?: string }) {
    setBusy(true);
    try { await call(`/conversations/${t.id}/messages`, 'POST', payload); if (!payload.attachmentId) setBody(''); await refresh(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function sendImage(f: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', await shrinkImage(f));
      const r = await call<{ id: string }>(`/conversations/${t.id}/images`, 'POST', fd);
      await send({ body: '', attachmentId: r.id });
    } catch (e) { toast((e as Error).message, 'error'); } finally { setUploading(false); }
  }
  async function toggleBlock(skipConfirm = false) {
    if (!t.iBlocked && !skipConfirm && !confirm(`Zablokovat uživatele ${t.other.name}? Nebude vám moci psát.`)) return;
    try { await call(`/users/${t.other.id}/${t.iBlocked ? 'unblock' : 'block'}`, 'POST'); await refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  }
  async function toggleArchive() {
    try {
      await call(`/conversations/${t.id}/${t.archived ? 'unarchive' : 'archive'}`, 'POST');
      if (t.archived) { toast('Konverzace je zpět mezi aktivními'); await refresh(); router.refresh(); }
      else { toast('Konverzace přesunuta do archivu'); router.push('/zpravy'); router.refresh(); }
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  const ArchIcon = t.archived ? ArchiveRestore : Archive;
  const archLabel = t.archived ? 'Vrátit z archivu' : 'Archivovat';
  return (
    <section className="flex h-[calc(100dvh-8.5rem)] min-w-0 flex-col sm:h-[calc(100dvh-10rem)]">
      <header className="flex items-center gap-2 border-b border-line bg-surface p-3 sm:gap-3">
        <Link href={t.archived ? '/zpravy?archiv=1' : '/zpravy'} className="btn btn-ghost btn-sm px-2 lg:hidden" aria-label="Zpět na zprávy"><ArrowLeft className="size-5" /></Link>
        <Avatar name={t.other.name} url={t.other.avatarUrl} size={36} />
        <div className="min-w-0 flex-1"><Link href={`/uzivatel/${t.other.id}`} className="block truncate font-semibold hover:underline">{t.other.name}</Link><div className="text-xs text-muted">{t.listing ? (t.role === 'buyer' ? 'Prodejce' : 'Zájemce') : 'Zpráva z profilu'}{t.archived && ' · v archivu'}</div></div>
        <button type="button" onClick={toggleArchive} className="btn btn-ghost btn-sm px-2 sm:px-3" aria-label={archLabel} title={archLabel}><ArchIcon className="size-4" /><span className="hidden sm:inline">{t.archived ? 'Z archivu' : 'Archivovat'}</span></button>
        <button type="button" onClick={() => toggleBlock()} className="btn btn-ghost btn-sm px-2 sm:px-3" aria-label={t.iBlocked ? 'Odblokovat uživatele' : 'Zablokovat uživatele'} title={t.iBlocked ? 'Odblokovat' : 'Zablokovat'}><Ban className="size-4" /><span className="hidden sm:inline">{t.iBlocked ? 'Odblokovat' : 'Blokovat'}</span></button>
        <ChatReport kind="conversation" id={t.id} otherName={t.other.name} onBlocked={t.iBlocked ? undefined : () => toggleBlock(true)} />
      </header>
      {t.listing && (
        <Link href={listingUrl(t.listing)} className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-4 py-2.5 hover:bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {t.listing.image && <img src={t.listing.image} alt="" className="size-10 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{t.listing.title}</div><div className="text-sm">{price(t.listing.price, t.listing.priceNegotiable)}{t.listing.status !== 'ACTIVE' && <span className="ml-2 text-muted">· {STATUS_LABEL[t.listing.status]}</span>}</div></div>
        </Link>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto bg-paper p-4">
        <p className="mx-auto mb-2 flex max-w-md items-start justify-center gap-1.5 text-center text-xs text-muted"><ShieldCheck className="size-4 shrink-0 text-trust" aria-hidden />Váš e-mail ani telefon druhé straně neukazujeme. Domlouvejte se tady a nikdy neplaťte předem přes odkaz.</p>
        {t.messages.map((m, i) => {
          const mine = m.senderId === meId;
          const day = new Date(m.createdAt).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
          const showDay = i === 0 || new Date(t.messages[i - 1].createdAt).toDateString() !== new Date(m.createdAt).toDateString();
          return (
            <div key={m.id}>
              {showDay && <div className="my-3 text-center text-xs font-medium text-muted" suppressHydrationWarning>{day}</div>}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug sm:max-w-[80%] ${mine ? 'rounded-br-md bg-ink text-paper' : 'rounded-bl-md border border-line bg-surface'}`}>
                  {/* Fotky jsou vždy z našeho úložiště (server přijímá jen vlastní přílohy). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {m.imageUrl && <a href={m.imageUrl} target="_blank" rel="noopener noreferrer"><img src={m.imageUrl} alt="Fotka ve zprávě" className="mb-1 max-h-64 rounded-xl" loading="lazy" /></a>}
                  {/* Text se zobrazuje jako prostý text – odkazy záměrně nejsou klikací. */}
                  {m.body && <p className="whitespace-pre-line break-words">{m.body}</p>}
                  <div className={`mt-0.5 flex items-center justify-end gap-2 text-[11px] ${mine ? 'text-paper/60' : 'text-muted'}`}>
                    {!mine && <ChatReport kind="message" id={m.id} otherName={t.other.name} compact />}
                    <span suppressHydrationWarning>{new Date(m.createdAt).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}{mine && (m.readAt ? ' · přečteno' : '')}</span>
                  </div>
                </div>
              </div>
              {m.warning && <MessageWarning w={m.warning} />}
            </div>
          );
        })}
        {t.canReview && <ReviewBox convId={t.id} name={t.other.name} onDone={refresh} />}
        {t.myReview && <p className="py-2 text-center text-sm text-muted">Prodejce jste ohodnotili {'★'.repeat(t.myReview.rating)}</p>}
        <div ref={end} />
      </div>
      {t.blocked ? <p className="border-t border-line bg-surface p-4 text-center text-sm text-muted">Komunikace s tímto uživatelem je zablokovaná.</p> : (
        <form onSubmit={(e) => { e.preventDefault(); if (body.trim()) send({ body }); }} className="flex items-end gap-2 border-t border-line bg-surface p-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          {t.photos && <>
            <button type="button" onClick={() => file.current?.click()} disabled={uploading || busy} className="btn btn-ghost h-11 w-11 shrink-0 px-0" aria-label="Poslat fotku">{uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}</button>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) sendImage(f); }} />
          </>}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (body.trim() && !busy) send({ body }); } }} rows={1} maxLength={4000} placeholder="Napište zprávu…" className="input max-h-36 min-h-11 flex-1 resize-none py-2.5" aria-label="Zpráva" />
          <button className="btn btn-primary h-11 w-11 shrink-0 px-0" disabled={busy || !body.trim()} aria-label="Odeslat">{busy ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}</button>
        </form>
      )}
    </section>
  );
}

function ReviewBox({ convId, name, onDone }: { convId: string; name: string; onDone: () => void }) {
  const [rating, setRating] = useState(0); const [text, setText] = useState('');
  const toast = useToast();
  return (
    <div className="mx-auto my-4 max-w-md rounded-2xl border border-line bg-surface p-4 text-center">
      <div className="font-semibold">Jak proběhl obchod s {name}?</div>
      <div className="my-2 flex justify-center gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} onClick={() => setRating(n)} aria-label={`${n} hvězd`}><Star className={`size-8 ${n <= rating ? 'fill-top text-top' : 'text-line'}`} /></button>)}</div>
      {rating > 0 && <>
        <textarea className="input mt-2" rows={2} placeholder="Krátká recenze (nepovinné)" value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={async () => { try { await call(`/conversations/${convId}/review`, 'POST', { rating, text: text || undefined }); toast('Děkujeme za hodnocení'); onDone(); } catch (e) { toast((e as Error).message, 'error'); } }} className="btn btn-dark btn-sm mt-2">Odeslat hodnocení</button>
      </>}
    </div>
  );
}
