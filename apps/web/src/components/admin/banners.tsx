'use client';
import { ArrowDown, ArrowUp, ImagePlus, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { call } from '@/lib/client';
import { shrinkImage } from '@/lib/image';
import { useAct } from './dialog';

export interface AdminBanner { id: string; imageUrl: string; linkUrl: string | null; alt: string; active: boolean; position: number; clicks: number }

/** Kolik bannerů je na úvodní stránce vedle sebe (stejné číslo jako PUBLIC_BANNERS v API). */
const SHOWN = 3;

/** Náhled vybraného souboru (adresa blob: se po změně uvolní). */
function usePreview(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

async function form(fields: Record<string, string | boolean | null | undefined>, file?: File | null) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null) f.set(k, String(v));
  if (file) f.set('file', await shrinkImage(file, 2400));
  return f;
}

function FilePick({ id, onPick, label }: { id: string; onPick: (f: File | null) => void; label: string }) {
  return (
    <label htmlFor={id} className="btn btn-outline btn-sm cursor-pointer">
      <ImagePlus className="size-4" />{label}
      <input id={id} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}

/** Správa reklamních bannerů úvodní stránky: přidání, úprava, zapnutí/vypnutí, pořadí, smazání. */
export function BannersEditor({ rows }: { rows: AdminBanner[] }) {
  const act = useAct();
  const live = new Set(rows.filter((r) => r.active).slice(0, SHOWN).map((r) => r.id));
  return (
    <div className="space-y-4">
      <NewBanner />
      {rows.length === 0 ? (
        <p className="card p-6 text-center text-muted">Zatím tu není žádný banner. Dokud nepřidáte aktivní banner, řada bannerů se na úvodní stránce nezobrazuje.</p>
      ) : rows.map((b, i) => (
        <BannerRow key={`${b.id}-${b.imageUrl}`} b={b} live={live.has(b.id)}
          up={i > 0 ? () => act(() => call(`/admin/banners/${b.id}/move`, 'POST', { direction: 'up' }), 'Pořadí změněno') : undefined}
          down={i < rows.length - 1 ? () => act(() => call(`/admin/banners/${b.id}/move`, 'POST', { direction: 'down' }), 'Pořadí změněno') : undefined}
        />
      ))}
    </div>
  );
}

function NewBanner() {
  const act = useAct();
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState('');
  const [link, setLink] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const preview = usePreview(file);
  return (
    <form className="card grid gap-4 p-4 sm:grid-cols-[220px_1fr] sm:p-5" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const ok = await act(async () => call('/admin/banners', 'POST', await form({ alt, linkUrl: link, active }, file)), 'Banner přidán');
      setBusy(false);
      if (ok) { setFile(null); setAlt(''); setLink(''); setActive(true); }
    }}>
      <div>
        <div className="grid aspect-[2/1] place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <span className="px-3 text-center text-xs text-muted">Náhled banneru</span>}
        </div>
        <div className="mt-2"><FilePick id="nb-file" onPick={setFile} label={file ? 'Vybrat jiný' : 'Vybrat obrázek'} /></div>
      </div>
      <div className="grid content-start gap-3">
        <h2 className="font-bold">Nový banner</h2>
        <div><label className="label text-xs" htmlFor="nb-alt">Popis obrázku</label><input id="nb-alt" required minLength={2} maxLength={160} className="input" placeholder="např. Jarní výprodej nábytku – sleva 30 %" value={alt} onChange={(e) => setAlt(e.target.value)} /></div>
        <div><label className="label text-xs" htmlFor="nb-link">Odkaz (kam banner vede)</label><input id="nb-link" className="input" inputMode="url" placeholder="https://www.firma.cz/akce" value={link} onChange={(e) => setLink(e.target.value)} /></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={active} onChange={(e) => setActive(e.target.checked)} />Zobrazit hned</label>
          <button className="btn btn-dark" disabled={!file || busy}><Plus className="size-4" />{busy ? 'Nahrávám…' : 'Přidat banner'}</button>
        </div>
      </div>
    </form>
  );
}

function BannerRow({ b, live, up, down }: { b: AdminBanner; live: boolean; up?: () => void; down?: () => void }) {
  const act = useAct();
  const [alt, setAlt] = useState(b.alt);
  const [link, setLink] = useState(b.linkUrl ?? '');
  const [file, setFile] = useState<File | null>(null);
  const preview = usePreview(file);
  const dirty = alt !== b.alt || link !== (b.linkUrl ?? '') || !!file;
  const save = async (fields: Record<string, string | boolean>, f?: File | null) => act(async () => call(`/admin/banners/${b.id}`, 'PUT', await form(fields, f)));
  return (
    <form className="card grid gap-4 p-4 sm:grid-cols-[220px_1fr] sm:p-5" onSubmit={async (e) => { e.preventDefault(); if (await save({ alt, linkUrl: link }, file)) setFile(null); }}>
      <div>
        <div className={`relative aspect-[2/1] overflow-hidden rounded-xl border border-line bg-surface-2 ${b.active ? '' : 'opacity-50'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview ?? b.imageUrl} alt="" className="size-full object-cover" />
        </div>
        <div className="mt-2"><FilePick id={`bf-${b.id}`} onPick={setFile} label="Vyměnit obrázek" /></div>
      </div>
      <div className="grid content-start gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {live ? <span className="badge bg-brand-soft text-brand-ink">Na webu</span> : b.active ? <span className="badge bg-surface-2 text-muted">Čeká – zobrazují se jen první {SHOWN}</span> : <span className="badge bg-surface-2 text-muted">Vypnutý</span>}
          <span className="inline-flex items-center gap-1 text-muted"><MousePointerClick className="size-4" />{b.clicks} kliknutí</span>
          <span className="ml-auto flex gap-1">
            <button type="button" onClick={up} disabled={!up} className="btn btn-ghost btn-sm px-2" aria-label="Posunout výš (na webu víc vlevo)"><ArrowUp className="size-4" /></button>
            <button type="button" onClick={down} disabled={!down} className="btn btn-ghost btn-sm px-2" aria-label="Posunout níž (na webu víc vpravo)"><ArrowDown className="size-4" /></button>
            <button type="button" onClick={() => confirm('Smazat banner včetně obrázku?') && act(() => call(`/admin/banners/${b.id}`, 'DELETE'), 'Banner smazán')} className="btn btn-ghost btn-sm px-2 text-danger" aria-label="Smazat banner"><Trash2 className="size-4" /></button>
          </span>
        </div>
        <div><label className="label text-xs" htmlFor={`ba-${b.id}`}>Popis obrázku</label><input id={`ba-${b.id}`} required minLength={2} maxLength={160} className="input" value={alt} onChange={(e) => setAlt(e.target.value)} /></div>
        <div><label className="label text-xs" htmlFor={`bl-${b.id}`}>Odkaz</label><input id={`bl-${b.id}`} className="input" inputMode="url" placeholder="bez odkazu" value={link} onChange={(e) => setLink(e.target.value)} /></div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={b.active} onChange={(e) => save({ active: e.target.checked })} />Aktivní (zobrazovat na webu)</label>
          <button className="btn btn-dark btn-sm" disabled={!dirty}>Uložit</button>
        </div>
      </div>
    </form>
  );
}
