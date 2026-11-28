'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatPrice } from '@dej/shared';
import { call } from '@/lib/client';
import { ago, CONDITION_LABEL } from '@/lib/format';
import { useToast } from '../toast';

// ——— typy (odpovědi API /admin/feeds) ———
export type FieldMap = Record<string, string[]>;
export interface FeedMeta { categories: { id: string; label: string; parentSlug: string }[]; fields: { key: string; label: string; attr: boolean }[]; mailReady: boolean }
export interface FeedSettings {
  name: string; url: string; format: string; fieldMap: FieldMap; categoryMap: Record<string, string>; defaultCategoryId: string | null;
  defaultCity: string | null; defaultZip: string | null; requireApproval: boolean; intervalHours: number; maxItems: number; active: boolean;
}
export interface FeedRun { id: string; trigger: string; startedAt: string; finishedAt: string | null; status: string; items: number; created: number; updated: number; unchanged: number; removed: number; skipped: number; errors: number; message: string | null; problems: { id: string; title?: string; message: string }[] }
export interface FeedDetail extends FeedSettings {
  id: string; lastSyncAt: string | null; lastStatus: string | null; lastMessage: string | null; nextSyncAt: string | null; currentRunId: string | null;
  user: { id: string; email: string; name: string; companyName: string | null; companyId: string | null; companyVerifiedAt: string | null; partnerInvitedAt: string | null; status: string; claimed: boolean; invalidEmail: boolean };
  counts: Record<string, number>; runs: FeedRun[];
}
interface PreviewItem {
  id: string; title: string; category: string; newCategory: string; catSource: string; price: number | null; currency: string; place: string; images: number;
  firstImage: string | null; url: string | null; attributes: Record<string, unknown>; condition: string | null; action: string; pending: boolean; risk: string[]; listingId?: string;
}
interface Preview {
  format: string; detected: string; itemTag: string; total: number; used: number; limited: boolean; fields: { path: string; count: number; samples: string[] }[];
  fieldMap: FieldMap; duplicates: number; errors: { id: string; message: string }[]; errorCount: number;
  counts: { new: number; changed: number; unchanged: number; edited: number; blocked: number; review: number; missing: number };
  categories: { text: string; count: number; categoryId: string; label: string; source: string }[]; items: PreviewItem[];
}

const FORMAT_LABEL: Record<string, string> = { auto: 'Rozpoznat automaticky', heureka: 'Heureka / Zboží.cz', google: 'Google Nákupy (Merchant)', generic: 'Obecné XML (autobazar, reality, vlastní export)' };
const INTERVALS: [number, string][] = [[24, 'Jednou denně'], [12, 'Každých 12 hodin'], [6, 'Každých 6 hodin'], [48, 'Každé 2 dny'], [168, 'Jednou týdně'], [0, 'Jen ručně']];
const ACTION_LABEL: Record<string, string> = { new: 'Nový', changed: 'Změněný', unchanged: 'Beze změny', edited: 'Upravený u nás – nepřepíše se', blocked: 'Zamítnutý / smazaný – nepřepíše se' };
const RUN_STATUS: Record<string, [string, string]> = { ok: ['V pořádku', 'bg-brand-soft text-brand-ink'], partial: ['S upozorněním', 'bg-top-soft text-ink'], error: ['Chyba', 'bg-danger-soft text-danger'], running: ['Probíhá', 'bg-surface-2'] };
const CAT_SOURCE: Record<string, string> = { map: 'ručně', auto: 'odhad', default: 'výchozí', fallback: 'nezařazeno' };

export const EMPTY_SETTINGS: FeedSettings = { name: '', url: '', format: 'auto', fieldMap: {}, categoryMap: {}, defaultCategoryId: null, defaultCity: null, defaultZip: null, requireApproval: true, intervalHours: 24, maxItems: 1000, active: true };

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="badge bg-surface-2">Zatím neproběhla</span>;
  const [label, cls] = RUN_STATUS[status] ?? [status, 'bg-surface-2'];
  return <span className={`badge ${cls}`}>{label}</span>;
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return <div className="card p-4"><div className="text-sm text-muted">{label}</div><div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>{hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}</div>;
}

const settingsBody = (v: FeedSettings) => ({ ...v, defaultCity: v.defaultCity?.trim() || null, defaultZip: v.defaultZip?.trim() || null, defaultCategoryId: v.defaultCategoryId || null });

/** Nastavení feedu (sdílené pro založení i úpravu). */
function SettingsFields({ v, set, meta }: { v: FeedSettings; set: (v: FeedSettings) => void; meta: FeedMeta }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="pf-name">Název partnera</label><input id="pf-name" className="input" value={v.name} maxLength={120} placeholder="Např. Autobazar Novák" onChange={(e) => set({ ...v, name: e.target.value })} /></div>
      <div><label className="label" htmlFor="pf-url">Adresa XML feedu</label><input id="pf-url" className="input" type="url" inputMode="url" value={v.url} placeholder="https://www.partner.cz/export/feed.xml" onChange={(e) => set({ ...v, url: e.target.value })} /></div>
      <div><label className="label" htmlFor="pf-format">Formát</label><select id="pf-format" className="input" value={v.format} onChange={(e) => set({ ...v, format: e.target.value })}>{Object.entries(FORMAT_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div>
        <label className="label" htmlFor="pf-cat">Kategorie pro nezařazené nabídky</label>
        <select id="pf-cat" className="input" value={v.defaultCategoryId ?? ''} onChange={(e) => set({ ...v, defaultCategoryId: e.target.value || null })}>
          <option value="">Ostatní › Různé</option>
          {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div><label className="label" htmlFor="pf-city">Místo, když ho nabídka neuvádí</label><input id="pf-city" className="input" value={v.defaultCity ?? ''} maxLength={80} placeholder="Např. Brno (sídlo partnera)" onChange={(e) => set({ ...v, defaultCity: e.target.value })} /></div>
      <div><label className="label" htmlFor="pf-zip">PSČ (nepovinné)</label><input id="pf-zip" className="input" value={v.defaultZip ?? ''} maxLength={6} inputMode="numeric" placeholder="602 00" onChange={(e) => set({ ...v, defaultZip: e.target.value })} /></div>
      <div><label className="label" htmlFor="pf-int">Automatická synchronizace</label><select id="pf-int" className="input" value={v.intervalHours} onChange={(e) => set({ ...v, intervalHours: Number(e.target.value) })}>{INTERVALS.map(([h, l]) => <option key={h} value={h}>{l}</option>)}</select></div>
      <div><label className="label" htmlFor="pf-max">Nejvýše nabídek</label><input id="pf-max" className="input" inputMode="numeric" value={v.maxItems} onChange={(e) => set({ ...v, maxItems: Math.min(10000, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)) })} /></div>
      <label className="flex items-start gap-3 sm:col-span-2">
        <input type="checkbox" className="mt-0.5 size-5" checked={v.requireApproval} onChange={(e) => set({ ...v, requireApproval: e.target.checked })} />
        <span><span className="font-medium">Nové nabídky schvalovat ručně</span><span className="block text-sm text-muted">Doporučeno, dokud partnerovi nedůvěřujete. Bez zaškrtnutí se nabídky zveřejní hned; podezřelé (automatická kontrola) čekají na schválení vždy.</span></span>
      </label>
    </div>
  );
}

// ——— nový partner ———

export function NewPartner({ meta }: { meta: FeedMeta }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState<FeedSettings>(EMPTY_SETTINGS);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [acc, setAcc] = useState({ email: '', companyName: '', companyId: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const create = async () => {
    setBusy(true);
    try {
      const account = mode === 'existing' ? { mode, email: acc.email } : { mode, email: acc.email, companyName: acc.companyName || v.name, companyId: acc.companyId || undefined, phone: acc.phone || undefined };
      const r = await call<{ id: string }>('/admin/feeds', 'POST', { ...settingsBody(v), account });
      toast('Partner založen');
      router.push(`/admin/partneri/${r.id}`);
    } catch (e) { toast((e as Error).message, 'error'); setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">1. Feed a nastavení</h2>
        <SettingsFields v={v} set={setV} meta={meta} />
      </section>
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold">2. Účet, pod kterým se nabídky zobrazí</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Účet partnera">
          <button type="button" className={`chip ${mode === 'new' ? 'chip-active' : ''}`} aria-pressed={mode === 'new'} onClick={() => setMode('new')}>Založit nový firemní účet</button>
          <button type="button" className={`chip ${mode === 'existing' ? 'chip-active' : ''}`} aria-pressed={mode === 'existing'} onClick={() => setMode('existing')}>Partner už u nás účet má</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="pa-email">E-mail partnera</label><input id="pa-email" className="input" type="email" value={acc.email} onChange={(e) => setAcc({ ...acc, email: e.target.value })} /></div>
          {mode === 'new' && <>
            <div><label className="label" htmlFor="pa-company">Název firmy</label><input id="pa-company" className="input" value={acc.companyName} placeholder={v.name || 'Autobazar Novák s.r.o.'} onChange={(e) => setAcc({ ...acc, companyName: e.target.value })} /></div>
            <div><label className="label" htmlFor="pa-ico">IČO (nepovinné)</label><input id="pa-ico" className="input" inputMode="numeric" maxLength={10} value={acc.companyId} onChange={(e) => setAcc({ ...acc, companyId: e.target.value })} /></div>
            <div><label className="label" htmlFor="pa-phone">Telefon (nepovinné)</label><input id="pa-phone" className="input" type="tel" value={acc.phone} onChange={(e) => setAcc({ ...acc, phone: e.target.value })} /></div>
          </>}
        </div>
        <p className="text-sm text-muted">{mode === 'new' ? 'Účet vznikne bez hesla. Přístup partnerovi pošlete z detailu partnera (odkaz na nastavení hesla). IČO ověříte v sekci Firemní účty.' : 'Nabídky se přidají k existujícímu účtu s tímto e-mailem.'}</p>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">3. Kontrola a založení</h2>
        <p className="text-sm text-muted">Náhled načte feed a ukáže, jak se nabídky převedou. Nic se neukládá. Po založení upravíte přiřazení kategorií a polí a spustíte první import.</p>
        <div className="flex flex-wrap gap-2">
          <PreviewButton settings={v} onLoaded={setPreview} />
          <button className="btn btn-primary" onClick={create} disabled={busy || !v.name || !v.url || !acc.email}>{busy ? 'Zakládám…' : 'Založit partnera'}</button>
        </div>
      </section>
      {preview && <PreviewView p={preview} meta={meta} settings={v} setSettings={setV} />}
    </div>
  );
}

function PreviewButton({ settings, feedId, onLoaded, label }: { settings: FeedSettings; feedId?: string; onLoaded: (p: Preview) => void; label?: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { onLoaded(await call<Preview>('/admin/feeds/preview', 'POST', { ...settingsBody(settings), feedId })); } catch (e) { toast((e as Error).message, 'error'); }
    setLoading(false);
  };
  return <button className="btn btn-dark" onClick={load} disabled={loading || !settings.url}>{loading ? 'Načítám feed…' : label ?? 'Načíst náhled'}</button>;
}

// ——— náhled: přiřazení kategorií a polí, ukázka nabídek ———

function PreviewView({ p, meta, settings, setSettings }: { p: Preview; meta: FeedMeta; settings: FeedSettings; setSettings: (v: FeedSettings) => void }) {
  const [filter, setFilter] = useState<'all' | 'todo' | 'review'>('all');
  const items = p.items.filter((i) => filter === 'all' || (filter === 'todo' ? ['new', 'changed'].includes(i.action) : i.pending));
  const setCat = (text: string, id: string) => {
    const m = { ...settings.categoryMap };
    if (id) m[text] = id; else delete m[text];
    setSettings({ ...settings, categoryMap: m });
  };
  const setField = (key: string, value: string) => {
    const m = { ...settings.fieldMap };
    if (value === '__auto') delete m[key]; else m[key] = value === '__none' ? [] : [value];
    setSettings({ ...settings, fieldMap: m });
  };
  const fieldValue = (key: string) => { const m = settings.fieldMap[key]; return !m ? '__auto' : m.length ? m[0] : '__none'; };
  const sample = (path: string) => p.fields.find((f) => f.path === path)?.samples[0];

  return (
    <div className="space-y-6">
      {p.limited && <div className="card border-danger bg-danger-soft p-4 text-sm text-danger">Feed má {p.total} nabídek, použije se jen prvních {p.used} (limit „Nejvýše nabídek“).</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Nabídek ve feedu" value={p.total} hint={`Formát: ${FORMAT_LABEL[p.format] ?? p.format} · položka <${p.itemTag}>`} />
        <Stat label="Nové" value={p.counts.new} hint={p.counts.review ? `z toho ${p.counts.review} ke schválení` : undefined} />
        <Stat label="Změněné" value={p.counts.changed} hint={p.counts.unchanged ? `${p.counts.unchanged} beze změny` : undefined} />
        <Stat label="Ve feedu už nejsou" value={p.counts.missing} hint="stáhnou se při synchronizaci" />
      </div>
      {(p.errorCount > 0 || p.duplicates > 0) && (
        <div className="card space-y-1 p-4 text-sm">
          {p.duplicates > 0 && <p>{p.duplicates} nabídek má ve feedu stejné ID jako jiná – použije se jen první.</p>}
          {p.errorCount > 0 && <><p className="font-medium">{p.errorCount} položek nejde použít:</p><ul className="list-disc pl-5 text-muted">{p.errors.slice(0, 8).map((e) => <li key={e.id}>{e.id}: {e.message}</li>)}</ul></>}
        </div>
      )}

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Kategorie</h2>
        <p className="text-sm text-muted">Každé kategorii z feedu přiřaďte naši. „Automaticky“ = odhad podle názvu a parametrů. Změny se projeví po uložení.</p>
        <div className="divide-y divide-line">
          {p.categories.map((c) => (
            <div key={c.text} className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><div className="font-medium">{c.text || '(bez kategorie)'}</div><div className="text-xs text-muted">{c.count} nabídek</div></div>
              <select aria-label={`Naše kategorie pro ${c.text || 'nabídky bez kategorie'}`} className="input sm:w-80" value={settings.categoryMap[c.text] ?? ''} onChange={(e) => setCat(c.text, e.target.value)}>
                <option value="">{c.source === 'map' ? 'Automaticky' : `Automaticky: ${c.label} (${CAT_SOURCE[c.source]})`}</option>
                {meta.categories.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </section>

      <details className="card p-5">
        <summary className="cursor-pointer text-lg font-bold">Přiřazení polí feedu</summary>
        <p className="mt-2 text-sm text-muted">Většinou stačí automatika. Pokud se něco převádí špatně (např. název nebo cena), vyberte správné pole feedu.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {meta.fields.map((f) => {
            const eff = p.fieldMap[f.key];
            return (
              <div key={f.key}>
                <label className="label text-xs" htmlFor={`fm-${f.key}`}>{f.label}{f.attr ? ' (parametr)' : ''}</label>
                <select id={`fm-${f.key}`} className="input" value={fieldValue(f.key)} onChange={(e) => setField(f.key, e.target.value)}>
                  <option value="__auto">{`Automaticky${eff?.length ? `: ${eff.join(', ')}` : ' (nenalezeno)'}`}</option>
                  <option value="__none">Nepoužívat</option>
                  {p.fields.map((x) => <option key={x.path} value={x.path}>{x.path} – {x.samples[0]?.slice(0, 40) ?? ''}</option>)}
                </select>
                {eff?.[0] && sample(eff[0]) && <div className="mt-0.5 truncate text-xs text-muted">např. {sample(eff[0])}</div>}
              </div>
            );
          })}
        </div>
      </details>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtr">
          {([['all', 'Vše'], ['todo', 'Nové a změněné'], ['review', 'Ke schválení']] as const).map(([k, l]) => <button key={k} className={`chip ${filter === k ? 'chip-active' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        {items.length ? (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-muted"><tr className="[&_th]:px-4 [&_th]:py-3 [&_th]:font-medium"><th>Nabídka</th><th>Naše kategorie</th><th>Parametry</th><th>Místo</th><th className="text-right">Cena</th><th className="text-right">Fotky</th><th>Stav</th></tr></thead>
              <tbody>{items.map((i) => (
                <tr key={i.id} className="border-t border-line align-top [&_td]:px-4 [&_td]:py-2.5">
                  <td className="max-w-[260px]">
                    {i.listingId ? <Link href={`/inzerat/${i.listingId}/x`} target="_blank" className="font-medium hover:underline">{i.title}</Link> : <span className="font-medium">{i.title}</span>}
                    <div className="text-xs text-muted">ID {i.id}{i.condition ? ` · ${CONDITION_LABEL[i.condition]}` : ''}</div>
                  </td>
                  <td>{i.newCategory}<div className="text-xs text-muted">{i.category || '—'}</div></td>
                  <td className="max-w-[220px] text-xs text-muted">{Object.entries(i.attributes).map(([k, val]) => `${meta.fields.find((f) => f.key === k)?.label ?? k}: ${Array.isArray(val) ? val.join(', ') : String(val)}`).join(' · ') || '—'}</td>
                  <td className="text-muted">{i.place}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatPrice(i.price, i.price == null, i.currency)}</td>
                  <td className="text-right tabular-nums">{i.images}</td>
                  <td className="space-y-1">
                    <span className="badge bg-surface-2">{ACTION_LABEL[i.action] ?? i.action}</span>
                    {i.pending && <div><span className="badge bg-top-soft text-ink">Ke schválení</span>{i.risk.length > 0 && <div className="mt-1 text-xs text-muted">{i.risk.join(', ')}</div>}</div>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {p.used > p.items.length && <p className="border-t border-line px-4 py-2.5 text-sm text-muted">Zobrazeno prvních {p.items.length} z {p.used} nabídek.</p>}
          </div>
        ) : <p className="text-sm text-muted">V tomto výběru nic není.</p>}
      </section>
    </div>
  );
}

// ——— detail partnera ———

export function PartnerDetail({ feed, meta }: { feed: FeedDetail; meta: FeedMeta }) {
  const router = useRouter();
  const toast = useToast();
  const initial: FeedSettings = {
    name: feed.name, url: feed.url, format: feed.format, fieldMap: feed.fieldMap ?? {}, categoryMap: feed.categoryMap ?? {}, defaultCategoryId: feed.defaultCategoryId,
    defaultCity: feed.defaultCity, defaultZip: feed.defaultZip, requireApproval: feed.requireApproval, intervalHours: feed.intervalHours, maxItems: feed.maxItems, active: feed.active,
  };
  const [v, setV] = useState<FeedSettings>(initial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [sync, setSync] = useState<{ running: boolean; run?: FeedRun; remaining?: number } | null>(null);
  const [busy, setBusy] = useState('');
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const c = feed.counts;

  const save = async () => {
    setSaving(true);
    try { await call(`/admin/feeds/${feed.id}`, 'PATCH', settingsBody(v)); toast('Uloženo'); router.refresh(); } catch (e) { toast((e as Error).message, 'error'); }
    setSaving(false);
  };

  const runSync = async () => {
    if (dirty) await save();
    setSync({ running: true });
    let last: FeedRun | undefined;
    try {
      let stuck = 0, prevRemaining = Infinity;
      for (let i = 0; i < 500; i++) {
        const r = await call<{ done: boolean; run: FeedRun; remaining: number }>(`/admin/feeds/${feed.id}/sync`, 'POST', { skip: (last?.problems ?? []).map((p) => p.id) });
        last = r.run;
        setSync({ running: !r.done, run: r.run, remaining: r.remaining });
        if (r.done) break;
        stuck = r.remaining >= prevRemaining ? stuck + 1 : 0;
        prevRemaining = r.remaining;
        if (stuck >= 3) throw new Error('Synchronizace se nehýbe z místa');
      }
      toast(last?.status === 'error' ? 'Synchronizace skončila chybou' : 'Synchronizace dokončena', last?.status === 'error' ? 'error' : undefined);
    } catch (e) { toast(`Synchronizace se přerušila: ${(e as Error).message}. Spusťte ji znovu, pokračuje tam, kde skončila.`, 'error'); }
    setSync((s) => ({ ...s, running: false }));
    router.refresh();
  };

  const action = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast(ok); router.refresh(); } catch (e) { toast((e as Error).message, 'error'); }
    setBusy('');
  };
  const remove = async () => {
    const expire = confirm('Smazat partnera a stáhnout jeho inzeráty z webu?\n\nOK = smazat a stáhnout inzeráty (zůstanou v jeho účtu jako vypršelé)\nZrušit = nic nemazat');
    if (!expire) return;
    try { await call(`/admin/feeds/${feed.id}`, 'DELETE', { listings: 'expire' }); toast('Partner smazán'); router.push('/admin/partneri'); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Zveřejněné inzeráty" value={(c.ACTIVE ?? 0) + (c.RESERVED ?? 0)} />
        <Stat label="Čekají na schválení" value={c.PENDING ?? 0} />
        <Stat label="Stažené (už nejsou ve feedu)" value={c.EXPIRED ?? 0} />
        <Stat label="Poslední synchronizace" value={feed.lastSyncAt ? ago(feed.lastSyncAt) : '—'} hint={feed.nextSyncAt && feed.active ? `další ${new Date(feed.nextSyncAt).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : feed.active ? 'automatická synchronizace vypnutá' : 'partner je pozastavený'} />
      </div>
      {feed.lastMessage && <div className={`card p-4 text-sm ${feed.lastStatus === 'error' ? 'border-danger bg-danger-soft text-danger' : ''}`}><StatusBadge status={feed.lastStatus} /> <span className="ml-1">{feed.lastMessage}</span></div>}

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Synchronizace</h2>
        <p className="text-sm text-muted">Přidá nové nabídky, upraví změněné a stáhne ty, které z feedu zmizely. Nic se nezdvojí. Úpravy, které u nás udělal moderátor nebo partner, se nepřepíšou.</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={runSync} disabled={!!sync?.running || saving}>{sync?.running ? 'Synchronizuji…' : 'Synchronizovat teď'}</button>
          {(c.PENDING ?? 0) > 0 && <button className="btn btn-dark" disabled={!!busy} onClick={() => confirm(`Schválit a zveřejnit ${c.PENDING} čekajících inzerátů partnera?`) && action('approve', () => call(`/admin/feeds/${feed.id}/approve-pending`, 'POST'), 'Inzeráty schváleny')}>Schválit čekající ({c.PENDING})</button>}
          <Link className="btn btn-outline" href={`/admin/inzeraty?q=${encodeURIComponent(feed.user.email)}`}>Inzeráty partnera</Link>
          {feed.lastStatus === 'partial' && feed.lastMessage?.includes('nic nestáhli') && <button className="btn btn-outline" disabled={!!busy} onClick={() => confirm('Stáhnout z webu všechny nabídky, které ve feedu chybí?') && action('expire', () => call(`/admin/feeds/${feed.id}/expire-missing`, 'POST'), 'Chybějící nabídky staženy')}>Stáhnout chybějící</button>}
        </div>
        {sync?.run && (
          <p className="text-sm" aria-live="polite">
            {sync.running ? 'Probíhá: ' : 'Hotovo: '}nové {sync.run.created}, upravené {sync.run.updated}{sync.run.removed ? `, stažené ${sync.run.removed}` : ''}{sync.run.skipped ? `, nepřepsané ${sync.run.skipped}` : ''}{sync.run.errors ? `, chyby ${sync.run.errors}` : ''}{sync.running && sync.remaining ? ` · zbývá ${sync.remaining}` : ''}.
            {!sync.running && sync.run.message ? ` ${sync.run.message}` : ''}
          </p>
        )}
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">Nastavení</h2>{!v.active && <span className="badge bg-surface-2">Pozastaveno</span>}</div>
        <SettingsFields v={v} set={setV} meta={meta} />
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-0.5 size-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
          <span><span className="font-medium">Automatická synchronizace zapnutá</span><span className="block text-sm text-muted">Vypnutím partnera pozastavíte; jeho inzeráty zůstanou, jak jsou.</span></span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Ukládám…' : 'Uložit nastavení'}</button>
          <PreviewButton settings={v} feedId={feed.id} onLoaded={setPreview} label={preview ? 'Načíst náhled znovu' : 'Náhled a přiřazení kategorií'} />
          {dirty && <span className="self-center text-sm text-muted">Neuložené změny – uloží se i před synchronizací.</span>}
        </div>
      </section>

      {preview && <PreviewView p={preview} meta={meta} settings={v} setSettings={setV} />}

      <section className="card space-y-3 p-5">
        <h2 className="text-lg font-bold">Účet partnera</h2>
        <p className="text-sm"><Link href={`/uzivatel/${feed.user.id}`} target="_blank" className="font-medium hover:underline">{feed.user.companyName ?? feed.user.name}</Link> · {feed.user.email}{feed.user.companyId ? ` · IČO ${feed.user.companyId}` : ''} {feed.user.companyVerifiedAt ? <span className="badge bg-brand-soft text-brand-ink">Ověřená firma</span> : <Link href={`/admin/firmy?q=${encodeURIComponent(feed.user.email)}`} className="badge bg-surface-2 hover:underline">Neověřená – ověřit</Link>}</p>
        {feed.user.claimed ? <p className="text-sm text-muted">Partner má k účtu přístup (vidí zprávy od zájemců a statistiky).</p> : (
          <>
            <p className="text-sm text-muted">Partner zatím nemá heslo. Pozvánka mu pošle odkaz na nastavení hesla (platí 14 dní).{feed.user.partnerInvitedAt ? ` Naposledy odesláno ${ago(feed.user.partnerInvitedAt)}.` : ''}</p>
            {meta.mailReady
              ? <button className="btn btn-outline" disabled={!!busy || feed.user.invalidEmail} onClick={() => action('invite', () => call(`/admin/feeds/${feed.id}/invite`, 'POST'), 'Pozvánka odeslána')}>{feed.user.partnerInvitedAt ? 'Poslat pozvánku znovu' : 'Poslat partnerovi přístup'}</button>
              : <p className="rounded-lg bg-surface-2 p-3 text-sm">Pozvánku půjde poslat po nastavení odesílání e-mailů (Resend) na ostré doméně.</p>}
          </>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-lg font-bold">Historie synchronizací</h2>
        {feed.runs.length ? (
          <ul className="divide-y divide-line text-sm">
            {feed.runs.map((r) => (
              <li key={r.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span>{new Date(r.startedAt).toLocaleString('cs-CZ')}</span>
                  <span className="text-muted">{r.trigger === 'schedule' ? 'automaticky' : 'ručně'}</span>
                  <span className="text-muted">· {r.items} ve feedu · nové {r.created} · upravené {r.updated} · beze změny {r.unchanged}{r.removed ? ` · stažené ${r.removed}` : ''}{r.skipped ? ` · nepřepsané ${r.skipped}` : ''}{r.errors ? ` · chyby ${r.errors}` : ''}</span>
                </div>
                {r.message && <div className="mt-1 text-muted">{r.message}</div>}
                {r.problems.length > 0 && (
                  <details className="mt-1"><summary className="cursor-pointer text-muted">Problémy ({r.problems.length})</summary>
                    <ul className="mt-1 list-disc pl-5 text-muted">{r.problems.map((p) => <li key={p.id}>{p.title ?? p.id}: {p.message}</li>)}</ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Zatím žádná. Zkontrolujte náhled a spusťte první synchronizaci.</p>}
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="text-lg font-bold">Ukončit spolupráci</h2>
        <p className="text-sm text-muted">Smaže nastavení feedu a stáhne inzeráty partnera z webu. Jeho účet zůstane.</p>
        <button className="btn btn-danger btn-sm" onClick={remove}>Smazat partnera</button>
      </section>
    </div>
  );
}
