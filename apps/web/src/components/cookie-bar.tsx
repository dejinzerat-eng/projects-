'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const KEY = 'dej_cookies_ok';

/**
 * Informační lišta o cookies při první návštěvě. Web používá jen nezbytné cookies a místní úložiště
 * (viz /stranka/cookies), na ty se souhlas podle § 89 odst. 3 zákona č. 127/2005 Sb. nevyžaduje,
 * proto lišta jen informuje a nenabízí odmítnutí. Kdyby web později přidal analytické nebo reklamní
 * cookies, musí se z lišty stát souhlas s volbou „Přijmout / Odmítnout“ ještě před jejich načtením.
 */
export function CookieBar() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { setShow(!localStorage.getItem(KEY)); } catch { /* bez úložiště lištu neukazujeme opakovaně */ }
  }, []);
  if (!show) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* */ } setShow(false); };
  return (
    <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-4 md:bottom-6">
      <section aria-labelledby="cookie-t" className="animate-fade-up card flex w-full max-w-2xl flex-wrap items-center gap-x-4 gap-y-3 p-4 shadow-pop">
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="cookie-t" className="font-bold">Cookies</h2>
          <p className="mt-0.5 text-sm text-muted">Používáme jen nezbytné cookies, aby fungovalo přihlášení a web. Analytické ani reklamní cookies nepoužíváme. <Link href="/stranka/cookies" className="font-semibold text-brand-ink underline">Zásady používání cookies</Link></p>
        </div>
        <button type="button" onClick={close} className="btn btn-primary btn-sm">Rozumím</button>
      </section>
    </div>
  );
}
