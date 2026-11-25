'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { useToast } from '../toast';

/** Provede akci, ukáže výsledek a obnoví data stránky. */
export function useAct() {
  const router = useRouter(); const toast = useToast();
  return async (fn: () => Promise<unknown>, ok = 'Uloženo') => {
    try { await fn(); toast(ok); router.refresh(); return true; } catch (e) { toast((e as Error).message, 'error'); return false; }
  };
}

interface Ask { title: string; label?: string; placeholder?: string; confirm?: string; danger?: boolean; required?: boolean; initial?: string; hint?: string }

/** Dialog s důvodem (zamítnutí, blokace, úprava cizího inzerátu…). `ask()` vrátí text, nebo null při zrušení. */
export function useReasonDialog() {
  const [state, setState] = useState<(Ask & { value: string }) | null>(null);
  const resolver = useRef<(v: string | null) => void>(undefined);
  const ask = useCallback((o: Ask) => new Promise<string | null>((resolve) => { resolver.current = resolve; setState({ required: true, ...o, value: o.initial ?? '' }); }), []);
  const close = (v: string | null) => { resolver.current?.(v); setState(null); };
  const tooShort = !!state?.required && state.value.trim().length < 3;
  const dialog = state && (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="reason-t">
      <div className="absolute inset-0 bg-ink/40" onClick={() => close(null)} />
      <form className="animate-fade-up relative w-full max-w-md space-y-3 rounded-t-3xl bg-surface p-6 sm:rounded-3xl" onSubmit={(e) => { e.preventDefault(); if (!tooShort) close(state.value.trim()); }}>
        <h2 id="reason-t" className="text-lg font-bold">{state.title}</h2>
        {state.hint && <p className="text-sm text-muted">{state.hint}</p>}
        <div>
          <label className="label" htmlFor="reason-v">{state.label ?? 'Důvod'}{state.required ? '' : ' (nepovinné)'}</label>
          <textarea id="reason-v" autoFocus rows={3} className="input" placeholder={state.placeholder} value={state.value} onChange={(e) => setState({ ...state, value: e.target.value })} maxLength={500} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => close(null)} className="btn btn-ghost">Zrušit</button>
          <button disabled={tooShort} className={`btn ${state.danger ? 'btn-danger' : 'btn-dark'} disabled:opacity-50`}>{state.confirm ?? 'Potvrdit'}</button>
        </div>
      </form>
    </div>
  );
  return { ask, dialog };
}
