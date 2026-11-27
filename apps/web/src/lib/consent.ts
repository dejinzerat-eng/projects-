/**
 * Souhlas s analytickými cookies (Google Analytics 4).
 * Volbu ukládáme jen v prohlížeči (localStorage). Dokud návštěvník nesouhlasí, skript Googlu se vůbec nenačte
 * (Consent Mode v základním režimu), jak vyžaduje § 89 odst. 3 zákona č. 127/2005 Sb.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? 'G-DLDHDZQ91V';
export const CONSENT_KEY = 'dej_consent';
/** Událost pro znovuotevření lišty (odkaz „Nastavení cookies“ v patičce). */
export const CONSENT_OPEN_EVENT = 'dej:consent-open';

export type Consent = 'granted' | 'denied';

export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch { return null; }
}

export function saveConsent(v: Consent) {
  try { localStorage.setItem(CONSENT_KEY, v); } catch { /* bez úložiště se volba neuloží */ }
}

type GtagWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };

/** Načte Google Analytics až po souhlasu. Je-li už načtený (souhlas obnoven), jen znovu povolí měření. */
export function loadAnalytics() {
  if (!GA_ID || typeof window === 'undefined') return;
  const w = window as GtagWindow;
  if (w.gtag) { w.gtag('consent', 'update', { analytics_storage: 'granted' }); return; }
  w.dataLayer = w.dataLayer || [];
  // gtag musí do dataLayer vkládat objekt `arguments`, ne pole
  w.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  w.gtag('js', new Date());
  w.gtag('config', GA_ID);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(s);
}

/** Po odvolání souhlasu: zastaví měření a smaže cookies Google Analytics (_ga, _ga_*). */
export function revokeAnalytics() {
  const w = window as GtagWindow;
  w.gtag?.('consent', 'update', { analytics_storage: 'denied' });
  const host = location.hostname;
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`];
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name === '_ga' || name.startsWith('_ga_')) {
      for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`;
    }
  }
}
