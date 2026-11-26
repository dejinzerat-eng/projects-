'use client';
import { CheckCircle2, Clock, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { call } from '@/lib/client';

type Result = { listing: { id: string; slug: string | null; status: string } | null; publishError?: string; hasPassword: boolean };

/**
 * Potvrzení inzerátu vloženého bez registrace. Až kliknutím (POST) – odkaz z e-mailu mohou otevřít
 * i automatické kontroly v poště a ty nesmí inzerát zveřejnit. Po potvrzení je uživatel přihlášený
 * a může si rovnou nastavit heslo.
 */
export function GuestListingConfirm() {
  const token = useSearchParams()?.get('token') ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const router = useRouter();

  if (!token) return <p className="text-center text-ink-2">Odkaz není úplný. Otevřete ho prosím znovu z e-mailu.</p>;
  if (res) return <Done res={res} />;
  return (
    <div className="space-y-4">
      <p className="text-center text-ink-2">Kliknutím potvrdíte svůj e-mail a inzerát zveřejníme. Najdete ho pak ve svém účtu v Mých inzerátech.</p>
      {error && (
        <div role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">
          {error} Pokud jste inzerát už potvrdili, najdete ho po <Link href="/prihlaseni?zpet=/muj-ucet/inzeraty" className="underline">přihlášení</Link> v Mých inzerátech.
        </div>
      )}
      <button className="btn btn-primary w-full" disabled={busy} onClick={async () => {
        setBusy(true); setError(null);
        try { setRes(await call<Result>('/listings/guest/confirm', 'POST', { token })); router.refresh(); /* hlavička už ukáže přihlášeného */ } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>
        {busy ? 'Zveřejňuji…' : 'Potvrdit e-mail a zveřejnit inzerát'}
      </button>
    </div>
  );
}

function Done({ res }: { res: Result }) {
  const { listing, publishError } = res;
  const [pw, setPw] = useState('');
  const [pwState, setPwState] = useState<'idle' | 'busy' | 'done'>(res.hasPassword ? 'done' : 'idle');
  const [pwError, setPwError] = useState<string | null>(null);
  const live = listing?.status === 'ACTIVE';
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {publishError ? <TriangleAlert className="size-12 text-danger" /> : live ? <CheckCircle2 className="size-12 text-trust" /> : <Clock className="size-12 text-brand" />}
        <p className="text-ink-2">
          {publishError
            ? <>Jste přihlášení, ale inzerát se nepodařilo zveřejnit: <b>{publishError}</b> {listing ? 'Najdete ho v Mých inzerátech mezi koncepty.' : ''}</>
            : live ? 'Hotovo! Jste přihlášení a inzerát je zveřejněný.' : 'E-mail je ověřený. Inzerát teď zkontroluje moderátor a hned potom ho zveřejníme.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {live && listing?.slug && <Link href={`/inzerat/${listing.id}/${listing.slug}`} className="btn btn-primary">Zobrazit inzerát</Link>}
          <Link href="/muj-ucet/inzeraty" className={`btn ${live && listing?.slug ? 'btn-outline' : 'btn-primary'}`}>Moje inzeráty</Link>
        </div>
      </div>
      {pwState !== 'done' ? (
        <form className="space-y-3 border-t border-line pt-5" onSubmit={async (e) => {
          e.preventDefault(); setPwState('busy'); setPwError(null);
          try { await call('/auth/password/change', 'POST', { current: '', password: pw }); setPwState('done'); } catch (err) { setPwError((err as Error).message); setPwState('idle'); }
        }}>
          <div>
            <label className="label" htmlFor="pw">Nastavte si heslo <span className="font-normal text-muted">(doporučujeme)</span></label>
            <input id="pw" type="password" autoComplete="new-password" minLength={8} required className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
            <p className="mt-1.5 text-xs text-muted">Alespoň 8 znaků. S heslem se přihlásíte i na jiném zařízení. Nastavit ho můžete i později v Nastavení účtu.</p>
          </div>
          {pwError && <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{pwError}</p>}
          <button className="btn btn-dark w-full" disabled={pwState === 'busy'}>{pwState === 'busy' ? 'Ukládám…' : 'Uložit heslo'}</button>
        </form>
      ) : !res.hasPassword && <p className="rounded-xl bg-trust-soft p-3 text-center text-sm text-trust">Heslo je nastavené.</p>}
    </div>
  );
}
