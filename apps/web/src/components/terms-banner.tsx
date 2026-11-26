'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { call } from '@/lib/client';
import { useToast } from './toast';

/** Po změně podmínek používání: číst web lze dál, zveřejňovat a psát až po souhlasu (API vrací 403). */
export function TermsBanner() {
  const router = useRouter(); const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return null;
  async function accept() {
    setBusy(true);
    try { await call('/me/terms', 'POST'); setDone(true); toast('Děkujeme, souhlas jsme uložili'); router.refresh(); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); }
  }
  return (
    <div className="container-x pt-4">
      <section aria-labelledby="terms-t" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-trust-soft p-4 text-trust">
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="terms-t" className="font-bold">Aktualizovali jsme podmínky</h2>
          <p className="mt-0.5 text-sm">Přečtěte si prosím <Link href="/stranka/podminky" className="font-semibold underline">nové podmínky používání</Link>. Bez souhlasu s nimi nelze zveřejňovat inzeráty ani psát zprávy.</p>
        </div>
        <button type="button" onClick={accept} disabled={busy} className="btn btn-dark btn-sm">{busy ? 'Ukládám…' : 'Souhlasím'}</button>
      </section>
    </div>
  );
}
