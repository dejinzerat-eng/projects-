import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { api } from './api';

/** ID oblíbených inzerátů přihlášeného uživatele (jednou za požadavek), jinak prázdná množina. */
export const getFavoriteIds = cache(async (): Promise<Set<string>> => {
  const c = await cookies();
  if (!c.get('dej_session')) return new Set();
  try { return new Set(await api<string[]>('/me/favorites/ids')); } catch { return new Set(); }
});
