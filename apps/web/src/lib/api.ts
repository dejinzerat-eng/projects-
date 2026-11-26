import 'server-only';
import { cookies, headers as requestHeaders } from 'next/headers';
import { redirect } from 'next/navigation';
import { loginUrl } from './safe-back';

const API_ENV = process.env.API_INTERNAL_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api` : undefined);

/**
 * Adresa API pro serverové komponenty. Na Vercelu běží API ve stejném nasazení (/api), a když adresa
 * není v proměnných prostředí (systémové proměnné Vercelu nemusí být zpřístupněné), použije se doména,
 * na kterou přišel požadavek. Lokálně samostatný server na portu 4000.
 */
async function apiBase(): Promise<string> {
  if (API_ENV) return API_ENV;
  if (process.env.VERCEL) {
    try {
      const h = await requestHeaders();
      const host = h.get('x-forwarded-host') ?? h.get('host');
      if (host) return `${h.get('x-forwarded-proto')?.split(',')[0] ?? 'https'}://${host}/api`;
    } catch { /* mimo požadavek (sestavení) – výchozí adresa */ }
  }
  return 'http://localhost:4000';
}

export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

/** Volání API ze serverových komponent – přeposílá cookie přihlášení. */
export async function api<T>(path: string, init: RequestInit & { revalidate?: number; auth?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.auth !== false) {
    const c = await cookies();
    const s = c.get('dej_session');
    if (s) headers.set('cookie', `dej_session=${s.value}`);
  }
  const r = await fetch(`${await apiBase()}${path}`, { ...init, headers, cache: init.revalidate ? 'force-cache' : 'no-store', next: init.revalidate ? { revalidate: init.revalidate } : undefined });
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).message ?? msg; } catch { /* */ }
    throw new ApiError(r.status, msg);
  }
  return r.json() as Promise<T>;
}

/** Cesta aktuální stránky (nastavuje ji src/proxy.ts u stránek jen pro přihlášené). */
export async function currentPath(fallback: string) {
  return (await requestHeaders()).get('x-pathname') ?? fallback;
}

/** Přesměrování na přihlášení s návratem na aktuální stránku. */
export async function redirectToLogin(fallback: string): Promise<never> {
  redirect(loginUrl(await currentPath(fallback)));
}

/** Jako api(), ale neplatné přihlášení (401) tiše přesměruje na přihlášení místo chyby stránky. */
export async function authApi<T>(path: string, fallback: string): Promise<T> {
  try { return await api<T>(path); } catch (e) {
    if (e instanceof ApiError && e.status === 401) return redirectToLogin(fallback);
    throw e;
  }
}

export async function getMe() {
  try { return (await api<{ user: Me | null }>('/auth/me')).user; } catch { return null; }
}

export interface Me {
  id: string; email: string; name: string; role: import('@dej/shared').Role; phone: string | null; avatarUrl: string | null;
  city: string | null; bio: string | null; isBusiness: boolean; companyName: string | null; companyId: string | null;
  emailVerifiedAt: string | null; phoneVerifiedAt: string | null; createdAt: string; hasPassword: boolean; unreadMessages: number; unreadNotifications: number;
  /** Uživatel ještě neodsouhlasil aktuální verzi podmínek používání */
  termsOutdated?: boolean;
}
