'use client';
import { useEffect, useSyncExternalStore } from 'react';

/**
 * Odznaky nepřečtených zpráv a upozornění v hlavičce. Výchozí hodnotu dodá server (při načtení stránky),
 * prohlížeč se pak zhruba jednou za minutu doptá – jen když je karta vidět, skrytá karta se neptá vůbec.
 */
export interface Unread { messages: number; notifications: number }

const POLL_MS = 60_000;
let current: Unread | null = null;
let lastFetch = 0;
let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let stopped = false;
let lastSeed = '';
const listeners = new Set<() => void>();

function set(next: Unread) {
  if (current && current.messages === next.messages && current.notifications === next.notifications) return;
  current = next;
  listeners.forEach((l) => l());
}

/** Načte aktuální počty hned (např. po přečtení upozornění). */
export async function refreshUnread() {
  if (stopped || typeof document === 'undefined') return;
  lastFetch = Date.now();
  try {
    const r = await fetch('/api/me/unread', { credentials: 'include', cache: 'no-store' });
    if (r.status === 401 || r.status === 403) { stop(); return; }
    if (r.ok) set(await r.json() as Unread);
  } catch { /* offline – zkusíme příště */ }
}

const tick = () => { if (document.visibilityState === 'visible' && Date.now() - lastFetch >= POLL_MS - 1000) void refreshUnread(); };
const onVisible = () => { if (document.visibilityState === 'visible') tick(); };

function ensure() {
  if (users === 0 || stopped || timer) return;
  timer = setInterval(tick, POLL_MS);
  document.addEventListener('visibilitychange', onVisible);
}
function halt() {
  if (timer) clearInterval(timer);
  timer = undefined;
  document.removeEventListener('visibilitychange', onVisible);
}
/** Odhlášení (401): přestaneme se ptát, dokud server znovu nepošle počty přihlášeného uživatele. */
function stop() { stopped = true; halt(); }

function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }

/**
 * Aktuální počty: poslední hodnota z dotazování, jinak ze serveru. Novější hodnota ze serveru (navigace, refresh) má přednost.
 * `enabled` = false (nepřihlášený návštěvník) → žádné dotazování.
 */
export function useUnread(initial: Unread, enabled = true): Unread {
  const snap = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    if (!enabled) return;
    // Komponenta připojená později se stejnou (starší) hodnotou ze serveru nepřepíše novější výsledek dotazování
    const key = `${initial.messages}:${initial.notifications}`;
    if (key !== lastSeed) { lastSeed = key; lastFetch = Date.now(); set({ messages: initial.messages, notifications: initial.notifications }); }
    stopped = false; ensure();
  }, [enabled, initial.messages, initial.notifications]);
  useEffect(() => {
    if (!enabled) return;
    users++; ensure();
    return () => { if (--users === 0) halt(); };
  }, [enabled]);
  return enabled ? snap ?? initial : initial;
}
