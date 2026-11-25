import 'server-only';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { api, ApiError } from './api';

/** Neznámá adresa: zkusíme tabulku přesměrování z administrace (Správa SEO), jinak 404. */
export async function redirectOrNotFound(path: string): Promise<never> {
  let hit: { to: string; code: number } | null = null;
  try { hit = await api<{ to: string; code: number }>(`/seo/redirect?path=${encodeURIComponent(path)}`, { auth: false }); } catch (e) { if (!(e instanceof ApiError)) throw e; }
  if (hit) (hit.code === 301 || hit.code === 308 ? permanentRedirect : redirect)(hit.to);
  notFound();
}
