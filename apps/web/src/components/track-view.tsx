'use client';
import { useEffect } from 'react';
import { rememberInterest } from '@/lib/interest';

/** Zapamatuje si kategorii prohlíženého inzerátu pro „Doporučeno pro vás“ (jen v prohlížeči). */
export function TrackView({ id, cat, sub }: { id: string; cat: string; sub: string }) {
  useEffect(() => { rememberInterest({ id, cat, sub }); }, [id, cat, sub]);
  return null;
}
