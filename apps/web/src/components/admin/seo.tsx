'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { call } from '@/lib/client';
import { useToast } from '../toast';

function useAct() {
  const router = useRouter(); const toast = useToast();
  return async (fn: () => Promise<unknown>, ok = 'Uloženo') => { try { await fn(); toast(ok); router.refresh(); } catch (e) { toast((e as Error).message, 'error'); } };
}

type Redirect = { from: string; to: string; code: number; hits: number; createdAt: string };
export function Redirects({ rows }: { rows: Redirect[] }) {
  const act = useAct();
  const [f, setF] = useState({ from: '', to: '', code: 308 });
  return (
    <div className="space-y-3">
      <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); act(() => call('/admin/seo/redirects', 'POST', f).then(() => setF({ from: '', to: '', code: 308 })), 'Přesměrování uloženo'); }}>
        <div><label className="label text-xs" htmlFor="r-from">Stará adresa</label><input id="r-from" className="input" placeholder="/kategorie/stary-nazev" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
        <div><label className="label text-xs" htmlFor="r-to">Nová adresa</label><input id="r-to" className="input" placeholder="/kategorie/novy-nazev" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
        <div><label className="label text-xs" htmlFor="r-code">Typ</label><select id="r-code" className="input" value={f.code} onChange={(e) => setF({ ...f, code: Number(e.target.value) })}><option value={308}>Trvalé</option><option value={307}>Dočasné</option></select></div>
        <button className="btn btn-dark">Přidat</button>
      </form>
      {rows.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-muted"><tr className="[&_th]:px-4 [&_th]:py-3 [&_th]:font-medium"><th>Z</th><th>Na</th><th>Typ</th><th>Použito</th><th /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.from} className="border-t border-line [&_td]:px-4 [&_td]:py-2.5">
                <td className="font-mono text-xs">{r.from}</td><td className="font-mono text-xs"><Link href={r.to} target="_blank" className="hover:underline">{r.to}</Link></td>
                <td>{r.code === 308 || r.code === 301 ? 'trvalé' : 'dočasné'}</td><td>{r.hits}×</td>
                <td className="text-right"><button className="btn btn-ghost btn-sm" onClick={() => confirm(`Smazat přesměrování ${r.from}?`) && act(() => call(`/admin/seo/redirects?from=${encodeURIComponent(r.from)}`, 'DELETE'), 'Smazáno')}>Smazat</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="text-sm text-muted">Zatím žádná přesměrování. Použijí se pro adresy kategorií, inzerátů a stránek, které už neexistují.</p>}
    </div>
  );
}

type Cat = { id: string; slug: string; name: string; intro: string | null; children: { id: string; slug: string; name: string; intro: string | null }[] };
export function CategoryIntros({ rows }: { rows: Cat[] }) {
  const act = useAct();
  const all = rows.flatMap((c) => [{ ...c, label: c.name, path: `/kategorie/${c.slug}` }, ...c.children.map((s) => ({ ...s, label: `${c.name} › ${s.name}`, path: `/kategorie/${c.slug}/${s.slug}` }))]);
  const [id, setId] = useState(all[0]?.id);
  const sel = all.find((c) => c.id === id);
  return (
    <div className="card space-y-3 p-4">
      <div><label className="label text-xs" htmlFor="c-sel">Kategorie</label><select id="c-sel" className="input" value={id} onChange={(e) => setId(e.target.value)}>{all.map((c) => <option key={c.id} value={c.id}>{c.label}{c.intro ? ' ✓' : ''}</option>)}</select></div>
      {sel && <form key={sel.id} className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => call(`/admin/seo/categories/${sel.id}`, 'PUT', { intro: new FormData(e.currentTarget).get('intro') || null })); }}>
        <textarea name="intro" rows={5} className="input text-sm" defaultValue={sel.intro ?? ''} placeholder="Krátký úvodní text pro vyhledávače i návštěvníky (zobrazí se pod výpisem). Lze použít ## nadpis, - odrážky a **tučně**." />
        <div className="flex items-center justify-between"><Link href={sel.path} target="_blank" className="text-sm text-brand-ink hover:underline">Zobrazit kategorii</Link><button className="btn btn-dark btn-sm">Uložit text</button></div>
      </form>}
    </div>
  );
}

type Page = { slug: string; title: string; description: string | null; effectiveFrom: string | null; reviewedAt: string | null };
export function PageMeta({ rows }: { rows: Page[] }) {
  const act = useAct();
  const d = (v: string | null) => (v ? v.slice(0, 10) : '');
  return (
    <div className="space-y-3">{rows.map((p) => (
      <form key={p.slug} className="card grid gap-3 p-4 lg:grid-cols-[1fr_150px_150px_auto] lg:items-end" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); act(() => call(`/admin/seo/pages/${p.slug}`, 'PUT', { description: f.get('description') || null, effectiveFrom: f.get('effectiveFrom') || null, reviewedAt: f.get('reviewedAt') || null })); }}>
        <div><label className="label text-xs" htmlFor={`d-${p.slug}`}><Link href={`/stranka/${p.slug}`} target="_blank" className="hover:underline">{p.title}</Link> – meta popis</label><input id={`d-${p.slug}`} name="description" maxLength={300} className="input text-sm" defaultValue={p.description ?? ''} /></div>
        <div><label className="label text-xs" htmlFor={`e-${p.slug}`}>Účinné od</label><input id={`e-${p.slug}`} name="effectiveFrom" type="date" className="input text-sm" defaultValue={d(p.effectiveFrom)} /></div>
        <div><label className="label text-xs" htmlFor={`v-${p.slug}`}>Kontrola právníkem</label><input id={`v-${p.slug}`} name="reviewedAt" type="date" className="input text-sm" defaultValue={d(p.reviewedAt)} /></div>
        <button className="btn btn-outline btn-sm">Uložit</button>
      </form>
    ))}</div>
  );
}
