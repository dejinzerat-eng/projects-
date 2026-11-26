'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { call } from '@/lib/client';
import { safeBack } from '@/lib/safe-back';

function useSubmit() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return { error, busy, run };
}


type Providers = { google?: boolean; apple?: boolean; sms?: boolean; captchaSiteKey?: string | null };
let providersPromise: Promise<Providers> | undefined;
/** Dostupné způsoby přihlášení a klíč CAPTCHA z API (načte se jednou za stránku). */
export function useProviders() {
  const [p, setP] = useState<Providers | null>(null);
  useEffect(() => {
    providersPromise ??= fetch('/api/auth/providers').then((r) => r.json() as Promise<Providers>).catch(() => { providersPromise = undefined; return {}; });
    let alive = true;
    providersPromise.then((v) => alive && setP(v));
    return () => { alive = false; };
  }, []);
  return p;
}

/* ---------- Cloudflare Turnstile (CAPTCHA) ---------- */
type TurnstileApi = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void };
declare global { interface Window { turnstile?: TurnstileApi } }
let turnstileScript: Promise<TurnstileApi> | undefined;
function loadTurnstile() {
  turnstileScript ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    s.onerror = () => { turnstileScript = undefined; reject(new Error('turnstile')); };
    document.head.appendChild(s);
  });
  return turnstileScript;
}

/** Widget „Nejsem robot“. Vykreslí se jen tehdy, když API vrátí captchaSiteKey; `resetKey` po chybě vyžádá nový token. */
function Turnstile({ siteKey, onToken, resetKey }: { siteKey: string; onToken: (t: string) => void; resetKey: number }) {
  const el = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken); cb.current = onToken;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadTurnstile().then((t) => {
      if (!alive || !el.current) return;
      id.current = t.render(el.current, {
        sitekey: siteKey, language: 'cs', theme: 'auto', size: 'flexible',
        callback: (tok: string) => cb.current(tok), 'expired-callback': () => cb.current(''), 'error-callback': () => cb.current(''),
      });
    }).catch(() => alive && setFailed(true));
    return () => { alive = false; if (id.current) window.turnstile?.remove(id.current); id.current = null; };
  }, [siteKey]);
  useEffect(() => { if (resetKey && id.current) { window.turnstile?.reset(id.current); cb.current(''); } }, [resetKey]);
  return (
    <div>
      <div ref={el} className="min-h-[65px]" />
      {failed && <p className="text-sm text-danger">Ověření proti robotům se nenačetlo. Zkontrolujte připojení nebo blokování obsahu a obnovte stránku.</p>}
    </div>
  );
}

function SocialButtons({ providers, zpet, register }: { providers: Providers | null; zpet: string; register?: boolean }) {
  if (!providers?.google && !providers?.apple) return null;
  const q = zpet !== '/' ? `?zpet=${encodeURIComponent(zpet)}` : '';
  return (
    <div data-social className="space-y-2.5">
      {providers.google && (
        <a href={`/api/auth/google${q}`} className="btn btn-outline w-full">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.3-4.7 3.3-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1-3.7 1-2.8 0-5.3-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.9 14a6.6 6.6 0 0 1 0-4.1V7.1H2.2a11 11 0 0 0 0 9.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1L5.9 10c.8-2.6 3.3-4.6 6.1-4.6z" /></svg>
          Pokračovat přes Google
        </a>
      )}
      {providers.apple && (
        <a href={`/api/auth/apple${q}`} className="btn btn-outline w-full">
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2-.9-3.4-.9c-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1zM13.9 5c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" /></svg>
          Pokračovat přes Apple
        </a>
      )}
      {register && <p className="text-center text-xs text-muted">Pokračováním souhlasíte s <Link href="/stranka/podminky" className="underline">podmínkami používání</Link> a berete na vědomí <Link href="/stranka/ochrana-udaju" className="underline">zpracování osobních údajů</Link>.</p>}
    </div>
  );
}

function Divider() {
  return <div className="hidden [[data-social]+&]:flex my-5 items-center gap-3 text-xs uppercase tracking-wide text-muted"><span className="h-px flex-1 bg-line" />nebo e-mailem<span className="h-px flex-1 bg-line" /></div>;
}
function ErrorBox({ error }: { error: string | null }) {
  return error ? <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p> : null;
}

/** Hlášky po návratu z Google/Apple (?chyba=…). */
const OAUTH_ERRORS: Record<string, string> = {
  oauth: 'Přihlášení se nepodařilo dokončit. Zkuste to prosím znovu, nebo se přihlaste e-mailem.',
  blokovan: 'Tento účet je zablokován. Pokud jde o omyl, kontaktujte podporu.',
  email: 'Poskytovatel nám nesdílel ověřený e-mail. Přihlaste se jiným způsobem, nebo se zaregistrujte e-mailem.',
  google: 'Přihlášení přes Google zatím není nastavené.',
  apple: 'Přihlášení přes Apple zatím není nastavené.',
};

export function LoginForm() {
  const sp = useSearchParams()!;
  const providers = useProviders();
  const { error, busy, run } = useSubmit();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const zpet = safeBack(sp.get('zpet'));
  const chyba = sp.get('chyba');
  return (
    <>
      <SocialButtons providers={providers} zpet={zpet} />
      <Divider />
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await call('/auth/login', 'POST', { email, password }); location.href = zpet; }); }}>
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div>
          <div className="flex justify-between"><label className="label" htmlFor="pw">Heslo</label><Link href="/zapomenute-heslo" className="text-sm font-medium text-brand-ink hover:underline">Zapomenuté heslo?</Link></div>
          <input id="pw" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <ErrorBox error={error ?? (chyba ? OAUTH_ERRORS[chyba] ?? OAUTH_ERRORS.oauth : null)} />
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Přihlašuji…' : 'Přihlásit se'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Nemáte účet? <Link href={`/registrace${zpet !== '/' ? `?zpet=${encodeURIComponent(zpet)}` : ''}`} className="font-semibold text-brand-ink hover:underline">Zaregistrujte se zdarma</Link></p>
    </>
  );
}

export function RegisterForm() {
  const sp = useSearchParams()!;
  const providers = useProviders();
  const { error, busy, run } = useSubmit();
  const [f, setF] = useState({ name: '', email: '', password: '', terms: false, accountType: 'private' as 'private' | 'business', companyId: '', companyName: '' });
  const [captcha, setCaptcha] = useState('');
  const [reset, setReset] = useState(0);
  const zpet = safeBack(sp.get('zpet'));
  const siteKey = providers?.captchaSiteKey;
  return (
    <>
      <SocialButtons providers={providers} zpet={zpet} register />
      <Divider />
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          if (siteKey && !captcha) throw new Error('Potvrďte prosím, že nejste robot.');
          const { accountType, companyId, companyName, ...base } = f;
          const company = accountType === 'business' ? { companyId, ...(companyName.trim() ? { companyName } : {}) } : {};
          try { await call('/auth/register', 'POST', { ...base, accountType, ...company, ...(captcha ? { captcha } : {}) }); } catch (err) { if (siteKey) setReset((n) => n + 1); throw err; }
          location.href = zpet === '/' ? '/muj-ucet/nastaveni?vitejte=1' : zpet;
        });
      }}>
        <fieldset>
          <legend className="label">Typ účtu</legend>
          <div className="grid grid-cols-2 gap-2">
            {([['private', 'Soukromá osoba'], ['business', 'Firma']] as const).map(([v, l]) => (
              <label key={v} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 has-[:checked]:border-ink">
                <input type="radio" name="accountType" value={v} checked={f.accountType === v} onChange={() => setF({ ...f, accountType: v })} className="accent-[var(--brand)]" />{l}
              </label>
            ))}
          </div>
        </fieldset>
        {f.accountType === 'business' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ico">IČO</label>
              <input id="ico" className="input" inputMode="numeric" autoComplete="off" required pattern="\d{8}" title="IČO má 8 číslic." maxLength={8} value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value.replace(/\D/g, '') })} />
            </div>
            <div>
              <label className="label" htmlFor="cname">Název firmy <span className="font-normal text-muted">(nepovinné)</span></label>
              <input id="cname" className="input" autoComplete="organization" maxLength={120} value={f.companyName} onChange={(e) => setF({ ...f, companyName: e.target.value })} />
            </div>
            <p className="-mt-2 text-xs text-muted sm:col-span-2">IČO ověříme v registru ARES a obchodní jméno a sídlo doplníme odtud.</p>
          </div>
        )}
        <div><label className="label" htmlFor="name">{f.accountType === 'business' ? 'Jméno kontaktní osoby' : 'Jméno'}</label><input id="name" autoComplete="name" required className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="label" htmlFor="pw">Heslo</label><input id="pw" type="password" autoComplete="new-password" minLength={8} required className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /><p className="mt-1.5 text-xs text-muted">Alespoň 8 znaků.</p></div>
        <label className="flex items-start gap-3 text-sm text-ink-2">
          <input type="checkbox" className="mt-0.5 size-5 accent-[var(--brand)]" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} required />
          <span>Souhlasím s <Link href="/stranka/podminky" className="underline">podmínkami používání</Link> a beru na vědomí <Link href="/stranka/ochrana-udaju" className="underline">zpracování osobních údajů</Link>.</span>
        </label>
        {siteKey && <Turnstile siteKey={siteKey} onToken={setCaptcha} resetKey={reset} />}
        <ErrorBox error={error} />
        <button className="btn btn-primary w-full" disabled={busy || providers === null}>{busy ? 'Vytvářím účet…' : 'Vytvořit účet'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">Už máte účet? <Link href={`/prihlaseni${zpet !== '/' ? `?zpet=${encodeURIComponent(zpet)}` : ''}`} className="font-semibold text-brand-ink hover:underline">Přihlaste se</Link></p>
    </>
  );
}

export function ForgotForm() {
  const providers = useProviders();
  const { error, busy, run } = useSubmit();
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [reset, setReset] = useState(0);
  const siteKey = providers?.captchaSiteKey;
  if (done) return <p className="rounded-xl bg-trust-soft p-4 text-[15px] text-trust">Pokud u nás účet s tímto e-mailem existuje, poslali jsme na něj odkaz pro nastavení nového hesla.</p>;
  return (
    <form className="space-y-4" onSubmit={(e) => {
      e.preventDefault();
      run(async () => {
        if (siteKey && !captcha) throw new Error('Potvrďte prosím, že nejste robot.');
        try { await call('/auth/password/forgot', 'POST', { email, ...(captcha ? { captcha } : {}) }); } catch (err) { if (siteKey) setReset((n) => n + 1); throw err; }
        setDone(true);
      });
    }}>
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {siteKey && <Turnstile siteKey={siteKey} onToken={setCaptcha} resetKey={reset} />}
      <ErrorBox error={error} />
      <button className="btn btn-primary w-full" disabled={busy || providers === null}>Poslat odkaz</button>
    </form>
  );
}

export function ResetForm() {
  const sp = useSearchParams()!; const router = useRouter();
  const { error, busy, run } = useSubmit();
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  if (!sp.get('token')) return <p className="rounded-xl bg-danger-soft p-4 text-[15px] text-danger">Odkaz pro obnovu hesla není úplný. Otevřete ho prosím znovu z e-mailu, nebo si <Link href="/zapomenute-heslo" className="underline">pošlete nový</Link>.</p>;
  if (done) return (
    <div className="space-y-4">
      <p className="rounded-xl bg-trust-soft p-4 text-[15px] text-trust">Heslo je nastavené. Z bezpečnostních důvodů jsme vás odhlásili ze všech zařízení.</p>
      <button className="btn btn-primary w-full" onClick={() => router.push('/prihlaseni')}>Přihlásit se</button>
    </div>
  );
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); run(async () => { await call('/auth/password/reset', 'POST', { token: sp.get('token'), password }); setDone(true); }); }}>
      <div><label className="label" htmlFor="pw">Nové heslo</label><input id="pw" type="password" autoComplete="new-password" minLength={8} required className="input" value={password} onChange={(e) => setPassword(e.target.value)} /><p className="mt-1.5 text-xs text-muted">Alespoň 8 znaků.</p></div>
      <ErrorBox error={error} />
      <button className="btn btn-primary w-full" disabled={busy}>Nastavit heslo</button>
    </form>
  );
}

/** Potvrzení nového e-mailu až kliknutím (odkaz z e-mailu mohou otevřít i automatické kontroly v poště). */
export function EmailChangeConfirm({ token }: { token: string }) {
  const { error, busy, run } = useSubmit();
  const [done, setDone] = useState(false);
  if (!token) return <p className="text-center text-ink-2">Odkaz není úplný. Otevřete ho prosím znovu z e-mailu.</p>;
  if (done) return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="rounded-xl bg-trust-soft p-4 text-[15px] text-trust">Hotovo, nový e-mail je u vašeho účtu nastavený a ověřený.</p>
      <Link href="/muj-ucet/nastaveni" className="btn btn-primary">Nastavení účtu</Link>
    </div>
  );
  return (
    <div className="space-y-4">
      <p className="text-center text-ink-2">Kliknutím potvrdíte, že tuto adresu chcete používat pro svůj účet na Dejinzerat.cz.</p>
      <ErrorBox error={error} />
      <button className="btn btn-primary w-full" disabled={busy} onClick={() => run(async () => { await call('/auth/email/confirm', 'POST', { token }); setDone(true); })}>
        {busy ? 'Potvrzuji…' : 'Potvrdit nový e-mail'}
      </button>
    </div>
  );
}
