'use client';
import Link from 'next/link';
import Script from 'next/script';
import { CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { call } from '@/lib/client';

type Cat = { value: string; label: string; anonymous: boolean };
type Receipt = { ref: string; createdAt: string; emailSent: boolean };

/** Formulář oznámení nezákonného obsahu podle čl. 16 DSA – funguje i bez přihlášení. */
export function NoticeForm({ categories, url = '', name = '', email = '', captchaSiteKey }: { categories: Cat[]; url?: string; name?: string; email?: string; captchaSiteKey?: string | null }) {
  const [f, setF] = useState({ category: '', targetUrl: url, explanation: '', name, email, goodFaith: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Receipt | null>(null);
  const anonymous = categories.find((c) => c.value === f.category)?.anonymous ?? false;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const captcha = (new FormData(e.currentTarget).get('cf-turnstile-response') as string | null) ?? undefined;
      setDone(await call<Receipt>('/notices', 'POST', { ...f, captcha }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
      // Token Turnstile je jednorázový – po neúspěchu načteme nový
      (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="card p-6 sm:p-8" role="status">
        <CheckCircle2 className="size-10 text-brand" />
        <h2 className="mt-3 text-xl font-bold">Oznámení jsme přijali</h2>
        <p className="mt-2 text-ink-2">Číslo vašeho oznámení:</p>
        <p className="mt-1 select-all font-mono text-2xl font-bold tracking-wider">{done.ref}</p>
        <p className="mt-1 text-sm text-muted">Přijato {new Date(done.createdAt).toLocaleString('cs-CZ')}</p>
        <p className="mt-4 text-ink-2">{done.emailSent ? 'Potvrzení jsme vám poslali e-mailem. Na stejnou adresu vám pošleme i rozhodnutí s odůvodněním.' : 'Oznámení jste podali bez e-mailu, proto vám nemůžeme poslat rozhodnutí. Číslo si prosím uložte.'}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/" className="btn btn-primary">Zpět na úvod</Link>
          <Link href="/stranka/nahlasovani-obsahu" className="btn btn-outline">Jak oznámení vyřizujeme</Link>
        </div>
      </div>
    );
  }

  return (
    <form className="card space-y-5 p-5 sm:p-7" onSubmit={submit} noValidate>
      <div>
        <label className="label" htmlFor="n-cat">O jaký nezákonný obsah jde?</label>
        <select id="n-cat" className="input" required value={f.category} onChange={set('category')}>
          <option value="" disabled>Vyberte…</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="n-url">Přesná adresa (URL) obsahu</label>
        <input id="n-url" type="url" inputMode="url" required className="input" placeholder="https://dejinzerat.cz/inzerat/…" value={f.targetUrl} onChange={set('targetUrl')} />
        <p className="mt-1.5 text-xs text-muted">Zkopírujte odkaz na inzerát nebo profil z adresního řádku prohlížeče.</p>
      </div>
      <div>
        <label className="label" htmlFor="n-exp">Proč je obsah podle vás nezákonný?</label>
        <textarea id="n-exp" required rows={6} minLength={30} maxLength={5000} className="input" placeholder="Popište, co přesně je na obsahu nezákonné a případně podle jakého předpisu." value={f.explanation} onChange={set('explanation')} />
        <p className="mt-1.5 text-xs text-muted">{f.explanation.trim().length < 30 ? `Alespoň 30 znaků (zbývá ${30 - f.explanation.trim().length}).` : `${f.explanation.length} / 5000 znaků`}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="n-name">Jméno a příjmení{anonymous ? ' (nepovinné)' : ''}</label>
          <input id="n-name" autoComplete="name" required={!anonymous} className="input" value={f.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label" htmlFor="n-email">E-mail{anonymous ? ' (nepovinné)' : ''}</label>
          <input id="n-email" type="email" autoComplete="email" required={!anonymous} className="input" value={f.email} onChange={set('email')} />
        </div>
      </div>
      {anonymous && <p className="rounded-xl bg-trust-soft px-3.5 py-2.5 text-sm text-trust">Oznámení o sexuálním zneužívání dětí můžete podat anonymně. Pokud ale uvedete e-mail, pošleme vám potvrzení a rozhodnutí.</p>}
      <label className="flex items-start gap-3 text-sm text-ink-2">
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]" checked={f.goodFaith} onChange={set('goodFaith')} required />
        <span>Prohlašuji, že oznámení podávám v dobré víře a že informace a tvrzení v něm jsou podle mého nejlepšího vědomí přesné a úplné.</span>
      </label>
      {captchaSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={captchaSiteKey} data-language="cs" />
        </>
      )}
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">Údaje zpracujeme podle <Link href="/stranka/ochrana-udaju" className="underline">zásad ochrany osobních údajů</Link>. Autorovi obsahu vaše údaje nesdělíme, pokud to nebude nezbytně nutné.</p>
        <button className="btn btn-primary shrink-0" disabled={busy}>{busy ? 'Odesílám…' : 'Odeslat oznámení'}</button>
      </div>
    </form>
  );
}
