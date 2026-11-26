'use client';
import { useSyncExternalStore } from 'react';

/**
 * Stav srdíček v prohlížeči: co uživatel během návštěvy přidal/odebral se projeví ve všech mřížkách
 * (stejný inzerát bývá na hlavní stránce ve více sekcích). Výchozí hodnotu dodá server (prop `initial`).
 */
const overrides = new Map<string, boolean>();
const listeners = new Set<() => void>();
let version = 0;

export function setFavorite(id: string, on: boolean) {
  overrides.set(id, on);
  version++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/** Aktuální stav srdíčka: změna z této návštěvy, jinak hodnota ze serveru. */
export function useFavorite(id: string, initial: boolean): boolean {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return overrides.get(id) ?? initial;
}

let idsPromise: Promise<Set<string>> | null = null;
/** ID oblíbených pro mřížky vykreslené v prohlížeči (načte se jednou za návštěvu). */
export function loadFavoriteIds(): Promise<Set<string>> {
  idsPromise ??= fetch('/api/me/favorites/ids', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : []))
    .then((ids: string[]) => new Set(ids))
    .catch(() => new Set<string>());
  return idsPromise;
}
