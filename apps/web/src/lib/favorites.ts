import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { toSearchString, type SearchParams } from '@dej/shared';
import { api } from './api';

/** ID oblíbených inzerátů přihlášeného uživatele (jednou za požadavek), jinak prázdná množina. */
export const getFavoriteIds = cache(async (): Promise<Set<string>> => {
  const c = await cookies();
  if (!c.get('dej_session')) return new Set();
  try { return new Set(await api<string[]>('/me/favorites/ids')); } catch { return new Set(); }
});

/** Klíč uloženého hledání (bez stránky a řazení) – stejný tvar jako URL parametry. */
export function savedSearchKey(p: SearchParams): string {
  const { page: _p, sort: _s, ...query } = p;
  return toSearchString(query);
}

/** Klíče uložených hledání přihlášeného uživatele – tlačítko „Hlídat“ pak ví, že už hlídáme. */
export const getSavedSearchKeys = cache(async (): Promise<Set<string>> => {
  const c = await cookies();
  if (!c.get('dej_session')) return new Set();
  try { return new Set((await api<{ query: SearchParams }[]>('/me/saved-searches')).map((s) => savedSearchKey(s.query))); } catch { return new Set(); }
});
