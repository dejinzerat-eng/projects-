import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { savedSearchKey, type SearchParams } from '@dej/shared';
import { api } from './api';

/** ID oblíbených inzerátů přihlášeného uživatele (jednou za požadavek), jinak prázdná množina. */
export const getFavoriteIds = cache(async (): Promise<Set<string>> => {
  const c = await cookies();
  if (!c.get('dej_session')) return new Set();
  try { return new Set(await api<string[]>('/me/favorites/ids')); } catch { return new Set(); }
});

export { savedSearchKey };

/** Uložená hledání přihlášeného uživatele podle normalizovaného klíče → ID (tlačítko „Hlídat“ ví, že už hlídáte, a umí hlídání zrušit). */
export const getSavedSearches = cache(async (): Promise<Map<string, string>> => {
  const c = await cookies();
  if (!c.get('dej_session')) return new Map();
  try { return new Map((await api<{ id: string; query: SearchParams }[]>('/me/saved-searches')).map((s) => [savedSearchKey(s.query), s.id])); } catch { return new Map(); }
});
