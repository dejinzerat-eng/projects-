'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CONSENT_OPEN_EVENT, type Consent, loadAnalytics, readConsent, revokeAnalytics, saveConsent } from '@/lib/consent';

/**
 * Lišta se souhlasem s analytickými cookies (Google Analytics). Ukáže se, dokud návštěvník nezvolí
 * Přijmout nebo Odmítnout; obě volby jsou stejně výrazné. Volbu lze kdykoli změnit odkazem
 * „Nastavení cookies“ v patičce. Nezbytné cookies (přihlášení) souhlas nepotřebují.
 */
export function CookieBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const c = readConsent();
    if (c === 'granted') loadAnalytics();
    else if (c === null) setShow(true);
    const open = () => setShow(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);
  if (!show) return null;
  const choose = (v: Consent) => {
    saveConsent(v);
    if (v === 'granted') loadAnalytics(); else revokeAnalytics();
    setShow(false);
  };
  return (
    <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
      <section aria-labelledby="cookie-t" className="animate-fade-up card flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-3 p-4 shadow-pop">
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="cookie-t" className="font-bold">Cookies</h2>
          <p className="mt-0.5 text-sm text-muted">Nezbytné cookies používáme, aby fungovalo přihlášení a web. Se souhlasem použijeme i analytické cookies Google Analytics, které nám ukážou, jak web zlepšit. Reklamní cookies nepoužíváme. <Link href="/stranka/cookies" className="font-semibold text-brand-ink underline">Zásady používání cookies</Link></p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => choose('denied')} className="btn btn-outline btn-sm">Odmítnout</button>
          <button type="button" onClick={() => choose('granted')} className="btn btn-primary btn-sm">Přijmout</button>
        </div>
      </section>
    </div>
  );
}

/** Odkaz v patičce, který znovu otevře lištu a dovolí souhlas změnit nebo odvolat. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>Nastavení cookies</button>;
}
