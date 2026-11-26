'use client';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { call } from '@/lib/client';
import { useAct } from './dialog';

const toSlug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Filter = { key: string; label: string; type: 'select' | 'multiselect' | 'range' | 'boolean'; options?: string[]; unit?: string; min?: number; max?: number };
type Cat = { id: string; slug: string; name: string; icon: string | null; parentId: string | null; position: number; active: boolean; seoTitle: string | null; seoDescription: string | null; filters: Filter[]; _count: { listings: number; children: number } };
/** Klíč filtru z názvu: „Typ karoserie“ → typKaroserie (dokud ho správce nepřepíše ručně). */
const keyOf = (label: string) => toSlug(label).replace(/^[0-9-]+/, '').replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const TYPE_LABEL = { select: 'Výběr', multiselect: 'Více možností', range: 'Rozsah (číslo)', boolean: 'Ano / ne' };

export function CategoriesEditor({ rows }: { rows: Cat[] }) {
  const act = useAct();
  const [edit, setEdit] = useState<Cat | null>(null);
  const [del, setDel] = useState<Cat | null>(null);
  const parents = rows.filter((r) => !r.parentId);
  const subs = rows.filter((r) => r.parentId);
  const [newCat, setNewCat] = useState({ name: '', slug: '', parentId: '' });
  const childCount = (p: Cat) => rows.filter((s) => s.parentId === p.id).reduce((a, s) => a + s._count.listings, p._count.listings);
  const move = (c: Cat, direction: 'up' | 'down') => act(() => call(`/admin/categories/${c.id}/move`, 'POST', { direction }), 'Pořadí změněno');
  const Row = ({ c, sub }: { c: Cat; sub?: boolean }) => (
    <div className={`flex items-center gap-1.5 py-1.5 ${sub ? 'pl-4 pr-2 text-sm sm:pl-8' : 'px-2 font-semibold'}`}>
      <span className="min-w-0 flex-1 truncate">{c.name} <span className="font-normal text-muted">/{c.slug} · {sub ? c._count.listings : childCount(c)} inz.</span></span>
      {!c.active && <span className="badge bg-surface-2">skrytá</span>}
      <button type="button" onClick={(e) => { e.preventDefault(); move(c, 'up'); }} className="btn btn-ghost btn-sm px-2" aria-label={`Posunout ${c.name} nahoru`}><ArrowUp className="size-4" /></button>
      <button type="button" onClick={(e) => { e.preventDefault(); move(c, 'down'); }} className="btn btn-ghost btn-sm px-2" aria-label={`Posunout ${c.name} dolů`}><ArrowDown className="size-4" /></button>
      <button type="button" onClick={(e) => { e.preventDefault(); setEdit(c); }} className="btn btn-ghost btn-sm">Upravit</button>
      <button type="button" onClick={(e) => { e.preventDefault(); setDel(c); }} className="btn btn-ghost btn-sm px-2 text-danger" aria-label={`Smazat ${c.name}`}><Trash2 className="size-4" /></button>
    </div>
  );
  return (
    <div className="space-y-4">
      <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); act(() => call('/admin/categories', 'POST', { ...newCat, parentId: newCat.parentId || null }).then(() => setNewCat({ name: '', slug: '', parentId: newCat.parentId })), 'Kategorie přidána'); }}>
        <div><label className="label" htmlFor="nc-name">Nová kategorie</label><input id="nc-name" required className="input" placeholder="Název" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value, slug: toSlug(e.target.value) })} /></div>
        <div><label className="label" htmlFor="nc-slug">Adresa (slug)</label><input id="nc-slug" required className="input" value={newCat.slug} onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })} /></div>
        <div><label className="label" htmlFor="nc-parent">Nadřazená</label><select id="nc-parent" className="input" value={newCat.parentId} onChange={(e) => setNewCat({ ...newCat, parentId: e.target.value })}><option value="">— hlavní kategorie —</option>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <button className="btn btn-dark">Přidat</button>
      </form>
      <div className="card divide-y divide-line">
        {parents.map((p) => (
          <details key={p.id}>
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden"><Row c={p} /></summary>
            <div className="pb-2">{subs.filter((s) => s.parentId === p.id).map((s) => <Row key={s.id} c={s} sub />)}</div>
          </details>
        ))}
      </div>
      {edit && <CategoryDialog key={edit.id} cat={edit} parents={parents} onClose={() => setEdit(null)} />}
      {del && <DeleteCategory cat={del} targets={subs.filter((s) => s.id !== del.id)} parents={parents} onClose={() => setDel(null)} />}
    </div>
  );
}

function Modal({ title, onClose, children, onSubmit }: { title: string; onClose: () => void; children: React.ReactNode; onSubmit: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-end sm:place-items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <form className="relative max-h-[92dvh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-surface p-5 sm:rounded-3xl sm:p-6" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </form>
    </div>
  );
}

function CategoryDialog({ cat, parents, onClose }: { cat: Cat; parents: Cat[]; onClose: () => void }) {
  const act = useAct();
  const [v, setV] = useState(cat);
  const [filters, setFilters] = useState<Filter[]>(Array.isArray(cat.filters) ? cat.filters : []);
  const setF = (i: number, f: Partial<Filter>) => setFilters(filters.map((x, j) => (j === i ? { ...x, ...f } : x)));
  const canMove = cat._count.children === 0;
  return (
    <Modal title={`Upravit kategorii ${cat.name}`} onClose={onClose} onSubmit={() => act(() => call(`/admin/categories/${cat.id}`, 'PUT', {
      name: v.name, slug: v.slug, icon: v.icon || null, active: v.active, position: v.position, parentId: v.parentId, seoTitle: v.seoTitle || null, seoDescription: v.seoDescription || null,
      filters: filters.map((f) => ({ ...f, options: ['select', 'multiselect'].includes(f.type) ? (f.options ?? []).filter(Boolean) : undefined, unit: f.type === 'range' ? f.unit || undefined : undefined })),
    })).then((ok) => ok && onClose())}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="ce-name">Název</label><input id="ce-name" className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="ce-slug">Adresa (slug)</label><input id="ce-slug" className="input" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} /></div>
        <div>
          <label className="label" htmlFor="ce-parent">Nadřazená kategorie</label>
          <select id="ce-parent" className="input" value={v.parentId ?? ''} disabled={!canMove && !cat.parentId} onChange={(e) => setV({ ...v, parentId: e.target.value || null })}>
            <option value="">— hlavní kategorie —</option>
            {parents.filter((p) => p.id !== cat.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {!canMove && <p className="mt-1 text-xs text-muted">Kategorie s podkategoriemi zůstává hlavní.</p>}
        </div>
        <div><label className="label" htmlFor="ce-icon">Ikona (název z lucide)</label><input id="ce-icon" className="input" value={v.icon ?? ''} onChange={(e) => setV({ ...v, icon: e.target.value })} placeholder="např. car" /></div>
        <div><label className="label" htmlFor="ce-pos">Pořadí</label><input id="ce-pos" type="number" min={0} className="input" value={v.position} onChange={(e) => setV({ ...v, position: Number(e.target.value) })} /></div>
        <label className="flex items-center gap-2 sm:mt-7"><input type="checkbox" className="size-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Zobrazit na webu</label>
      </div>
      <div><label className="label" htmlFor="ce-seot">SEO titulek</label><input id="ce-seot" className="input" maxLength={120} value={v.seoTitle ?? ''} onChange={(e) => setV({ ...v, seoTitle: e.target.value })} /></div>
      <div><label className="label" htmlFor="ce-seod">SEO popis (meta description)</label><textarea id="ce-seod" className="input" rows={2} maxLength={300} value={v.seoDescription ?? ''} onChange={(e) => setV({ ...v, seoDescription: e.target.value })} /></div>
      <fieldset className="space-y-2">
        <legend className="label">Filtry a parametry</legend>
        {filters.map((f, i) => (
          <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input aria-label="Název filtru" className="input h-9 text-sm" placeholder="Název (např. Značka)" value={f.label} onChange={(e) => setF(i, { label: e.target.value, key: !f.key || f.key === keyOf(f.label) ? keyOf(e.target.value) : f.key })} />
            <input aria-label="Klíč filtru" className="input h-9 font-mono text-sm" placeholder="klíč (brand)" value={f.key} onChange={(e) => setF(i, { key: e.target.value })} />
            <select aria-label="Typ filtru" className="input h-9 text-sm" value={f.type} onChange={(e) => setF(i, { type: e.target.value as Filter['type'] })}>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <button type="button" onClick={() => setFilters(filters.filter((_, j) => j !== i))} className="btn btn-ghost btn-sm text-danger" aria-label="Odebrat filtr"><Trash2 className="size-4" /></button>
            {['select', 'multiselect'].includes(f.type) && <input aria-label="Možnosti" className="input h-9 text-sm sm:col-span-4" placeholder="Možnosti oddělené čárkou" value={(f.options ?? []).join(', ')} onChange={(e) => setF(i, { options: e.target.value.split(',').map((x) => x.trim()) })} />}
            {f.type === 'range' && <input aria-label="Jednotka" className="input h-9 text-sm sm:col-span-2" placeholder="Jednotka (km, m², …)" value={f.unit ?? ''} onChange={(e) => setF(i, { unit: e.target.value })} />}
          </div>
        ))}
        <button type="button" onClick={() => setFilters([...filters, { key: '', label: '', type: 'select', options: [] }])} className="btn btn-outline btn-sm"><Plus className="size-4" />Přidat filtr</button>
      </fieldset>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn btn-ghost">Zrušit</button><button className="btn btn-dark">Uložit</button></div>
    </Modal>
  );
}

function DeleteCategory({ cat, targets, parents, onClose }: { cat: Cat; targets: Cat[]; parents: Cat[]; onClose: () => void }) {
  const act = useAct();
  const [moveTo, setMoveTo] = useState('');
  const n = cat._count.listings;
  const name = (s: Cat) => `${parents.find((p) => p.id === s.parentId)?.name ?? ''} › ${s.name}`;
  return (
    <Modal title={`Smazat kategorii ${cat.name}`} onClose={onClose} onSubmit={() => act(() => call(`/admin/categories/${cat.id}${moveTo ? `?moveTo=${moveTo}` : ''}`, 'DELETE'), 'Kategorie smazána').then((ok) => ok && onClose())}>
      {cat._count.children ? <p className="text-sm">Kategorie má podkategorie ({cat._count.children}). Nejdříve je přesuňte jinam nebo smažte.</p> : n ? (
        <div>
          <p className="text-sm">V kategorii jsou inzeráty ({n}). Vyberte podkategorii, kam je přesunout:</p>
          <select required aria-label="Přesunout inzeráty do" className="input mt-2" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">— vyberte —</option>
            {targets.filter((t) => t.parentId).sort((a, b) => name(a).localeCompare(name(b), 'cs')).map((t) => <option key={t.id} value={t.id}>{name(t)}</option>)}
          </select>
        </div>
      ) : <p className="text-sm">Kategorie je prázdná a smaže se natrvalo.</p>}
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn btn-ghost">Zrušit</button>{!cat._count.children && <button className="btn btn-danger">Smazat</button>}</div>
    </Modal>
  );
}

type Price = { code: string; name: string; description: string | null; priceCzk: number; durationDays: number | null; active: boolean };
export function PricesEditor({ rows }: { rows: Price[] }) {
  const act = useAct();
  const [n, setN] = useState({ code: '', name: '', priceCzk: '', durationDays: '' });
  return (
    <div className="space-y-3">
      {rows.map((p) => <PriceRow key={p.code} p={p} save={(v) => act(() => call(`/admin/prices/${p.code}`, 'PUT', v))} />)}
      <form className="card grid gap-3 p-4 sm:grid-cols-[140px_1fr_110px_90px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); act(() => call(`/admin/prices/${encodeURIComponent(n.code)}`, 'PUT', { name: n.name, priceCzk: Number(n.priceCzk), durationDays: n.durationDays ? Number(n.durationDays) : null, active: true }).then(() => setN({ code: '', name: '', priceCzk: '', durationDays: '' })), 'Položka přidána'); }}>
        <div><label className="label text-xs" htmlFor="np-code">Kód</label><input id="np-code" required className="input font-mono uppercase" placeholder="TOP_14" value={n.code} onChange={(e) => setN({ ...n, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} /></div>
        <div><label className="label text-xs" htmlFor="np-name">Nová služba</label><input id="np-name" required className="input" placeholder="Název" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></div>
        <div><label className="label text-xs" htmlFor="np-price">Cena (Kč)</label><input id="np-price" required inputMode="numeric" className="input" value={n.priceCzk} onChange={(e) => setN({ ...n, priceCzk: e.target.value.replace(/\D/g, '') })} /></div>
        <div><label className="label text-xs" htmlFor="np-days">Dní</label><input id="np-days" inputMode="numeric" className="input" value={n.durationDays} onChange={(e) => setN({ ...n, durationDays: e.target.value.replace(/\D/g, '') })} /></div>
        <button className="btn btn-dark"><Plus className="size-4" />Přidat</button>
      </form>
    </div>
  );
}
function PriceRow({ p, save }: { p: Price; save: (v: Omit<Price, 'code'>) => void }) {
  const [v, setV] = useState(p);
  return (
    <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_120px_100px_auto]" onSubmit={(e) => { e.preventDefault(); const { code: _c, ...rest } = v; save(rest); }}>
      <div><div className="mb-1 font-mono text-xs text-muted">{p.code}</div><input className="input font-semibold" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Název" /><input className="input mt-2 text-sm" value={v.description ?? ''} onChange={(e) => setV({ ...v, description: e.target.value })} aria-label="Popis" placeholder="Popis" /></div>
      <div><label className="label text-xs">Cena (Kč)<input type="number" min={0} className="input mt-1" value={v.priceCzk} onChange={(e) => setV({ ...v, priceCzk: Number(e.target.value) })} /></label></div>
      <div><label className="label text-xs">Dní<input type="number" min={0} className="input mt-1" value={v.durationDays ?? ''} onChange={(e) => setV({ ...v, durationDays: e.target.value ? Number(e.target.value) : null })} /></label></div>
      <div className="flex flex-col justify-end gap-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Aktivní</label><button className="btn btn-dark btn-sm">Uložit</button></div>
    </form>
  );
}

type Page = { slug: string; title: string; content: string; system: boolean };
export function PagesEditor({ rows }: { rows: Page[] }) {
  const act = useAct();
  const [selSlug, setSelSlug] = useState<string | 'new'>(rows[0]?.slug ?? 'new');
  const sel = rows.find((r) => r.slug === selSlug);
  const [draft, setDraft] = useState({ title: '', slug: '' });
  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <ul className="flex gap-1 overflow-x-auto scrollbar-none lg:flex-col">
        {rows.map((r) => <li key={r.slug} className="shrink-0"><button onClick={() => setSelSlug(r.slug)} className={`w-full whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm ${selSlug === r.slug ? 'bg-ink text-paper' : 'hover:bg-surface-2'}`}>{r.title}</button></li>)}
        <li className="shrink-0"><button onClick={() => setSelSlug('new')} className={`flex w-full items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm font-medium ${selSlug === 'new' ? 'bg-ink text-paper' : 'text-brand-ink hover:bg-surface-2'}`}><Plus className="size-4" />Nová stránka</button></li>
      </ul>
      {selSlug === 'new' ? (
        <form className="card space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(() => call('/admin/pages', 'POST', { slug: draft.slug, title: draft.title, content: f.get('content') }).then(() => setSelSlug(draft.slug)), 'Stránka vytvořena'); }}>
          <h2 className="font-bold">Nová stránka</h2>
          <div><label className="label" htmlFor="np-title">Titulek</label><input id="np-title" required className="input" value={draft.title} onChange={(e) => setDraft({ title: e.target.value, slug: toSlug(e.target.value) })} placeholder="např. Pravidla inzerování" /></div>
          <div><label className="label" htmlFor="np-slug">Adresa</label><div className="flex items-center gap-1 text-sm"><span className="text-muted">/stranka/</span><input id="np-slug" required className="input" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} /></div></div>
          <div><label className="label" htmlFor="np-content">Obsah</label><textarea id="np-content" name="content" className="input min-h-60" /></div>
          <div className="flex justify-end"><button className="btn btn-dark">Vytvořit</button></div>
        </form>
      ) : sel && (
        <form key={sel.slug} className="card space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(() => call(`/admin/pages/${sel.slug}`, 'PUT', { title: f.get('title'), content: f.get('content') })); }}>
          <div><label className="label" htmlFor="pe-title">Titulek</label><input id="pe-title" name="title" className="input" defaultValue={sel.title} /></div>
          <div><label className="label" htmlFor="pe-content">Obsah</label><textarea id="pe-content" name="content" className="input min-h-80" defaultValue={sel.content} /></div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Link href={`/stranka/${sel.slug}`} target="_blank" className="text-sm text-brand-ink hover:underline">Zobrazit stránku</Link>
              {sel.system ? <span className="text-xs text-muted">Systémová stránka – nelze smazat</span> : <button type="button" onClick={() => confirm(`Smazat stránku „${sel.title}“? Obsah zůstane v auditním logu.`) && act(() => call(`/admin/pages/${sel.slug}`, 'DELETE').then(() => setSelSlug(rows.find((r) => r.slug !== sel.slug)?.slug ?? 'new')), 'Stránka smazána')} className="btn btn-ghost btn-sm text-danger"><Trash2 className="size-4" />Smazat</button>}
            </div>
            <button className="btn btn-dark">Uložit</button>
          </div>
        </form>
      )}
    </div>
  );
}
