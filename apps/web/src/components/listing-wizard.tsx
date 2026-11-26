'use client';
import { cleanParams, CONDITIONS, type FilterDef, OFFER_TYPES, parseVideoUrl, VIDEO_URL_ERROR } from '@dej/shared';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronLeft, ChevronRight, ImagePlus, Lightbulb, Loader2, MapPin, Save, Sparkles, Star, Trash2, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isImageFile, MAX_UPLOAD_BYTES, shrinkImage } from '@/lib/image';
import { useEffect, useRef, useState } from 'react';
import { call } from '@/lib/client';
import { CONDITION_LABEL, price as fmtPrice } from '@/lib/format';
import { CategoryIcon } from './icons';
import { LocationFields } from './location-fields';
import { useToast } from './toast';

export interface WizardInitial {
  id?: string; title: string; description: string; price: number | null; priceNegotiable: boolean; currency: 'CZK' | 'EUR';
  categorySlug: string; subSlug: string; condition: string | null; offerType: string; city: string; zip: string;
  attributes: Record<string, unknown>; images: { id: string; url: string; thumbUrl: string }[]; videoUrl: string; status?: string;
}
/** Kategorie z API (/categories) – jen aktivní; `fields` jsou výsledné parametry podkategorie. */
export interface WizardCategory {
  slug: string; name: string; icon: string | null;
  children: { slug: string; name: string; fields?: FilterDef[] }[];
}
const EMPTY: WizardInitial = { title: '', description: '', price: null, priceNegotiable: false, currency: 'CZK', categorySlug: '', subSlug: '', condition: null, offerType: 'SELL', city: '', zip: '', attributes: {}, images: [], videoUrl: '' };
const STEPS = ['Co nabízíte', 'Fotky', 'Popis a cena', 'Místo', 'Náhled'];
const DRAFT_KEY = 'dej_wizard_draft';
/** Pole ze serverové chyby → krok průvodce, kde ho uživatel opraví */
const FIELD_STEP: Record<string, number> = { title: 0, categorySlug: 0, subSlug: 0, offerType: 0, imageIds: 1, videoUrl: 1, description: 2, price: 2, currency: 2, condition: 2, attributes: 2, city: 3, zip: 3 };

class SendError extends Error { constructor(message: string, public field?: string, public status?: number) { super(message); } }
async function send<T>(path: string, method: string, body: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) {
    let msg = 'Něco se pokazilo. Zkuste to prosím znovu.'; let field: string | undefined;
    try { const j = await r.json(); msg = (Array.isArray(j.message) ? j.message[0] : j.message) ?? msg; field = typeof j.field === 'string' ? j.field.split('.')[0] : undefined; } catch { /* */ }
    if (r.status === 429) msg = 'Příliš mnoho požadavků. Chvíli počkejte.';
    throw new SendError(msg, field, r.status);
  }
  return r.json() as Promise<T>;
}

export function ListingWizard({ initial, defaultCity, categories, userId }: { initial?: WizardInitial; defaultCity?: string | null; categories: WizardCategory[]; userId?: string }) {
  // Rozpracovaný inzerát v prohlížeči patří přihlášenému uživateli (sdílený počítač)
  const draftKey = userId ? `${DRAFT_KEY}:${userId}` : DRAFT_KEY;
  const [d, setD] = useState<WizardInitial>(initial ?? { ...EMPTY, city: defaultCity ?? '' });
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [uploading, setUploading] = useState(0);
  const router = useRouter(); const toast = useToast();
  const fromServer = !!initial?.id;
  const isDraft = !d.id || d.status === 'DRAFT';
  const live = !isDraft;
  const up = (p: Partial<WizardInitial>) => setD((x) => ({ ...x, ...p }));
  // Měření cíle „inzerát do 60 sekund“: od otevření průvodce po zveřejnění
  const startedAt = useRef(Date.now());

  const cat = categories.find((c) => c.slug === d.categorySlug);
  const sub = cat?.children.find((s) => s.slug === d.subSlug);
  const fields = sub?.fields ?? [];

  // Rozpracovaný nový inzerát si pamatujeme v prohlížeči
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (fromServer) return;
    try {
      if (userId) try { localStorage.removeItem(DRAFT_KEY); } catch { /* starý klíč bez uživatele */ }
      const s = localStorage.getItem(draftKey); const v = s ? JSON.parse(s) : null;
      if (v?.title) {
        const { _startedAt, ...rest } = v;
        setD((cur) => (cur.title ? cur : { ...EMPTY, ...rest }));
        if (typeof _startedAt === 'number' && Date.now() - _startedAt < 3600e3) startedAt.current = _startedAt;
        setRestored(true);
        // Koncept uložený na serveru mohl být mezitím zveřejněn nebo smazán (jinde, v jiném okně) –
        // pak už ho z /pridat nesmíme přepsat, pokračujeme jako s novým inzerátem.
        if (typeof rest.id === 'string') {
          call<{ status: string }>(`/listings/${rest.id}/edit`)
            .then((l) => { if (l.status !== 'DRAFT') setD((x) => (x.id === rest.id ? { ...x, id: undefined, status: undefined } : x)); })
            .catch(() => setD((x) => (x.id === rest.id ? { ...x, id: undefined, status: undefined } : x)));
        }
      }
    } catch { /* */ }
  }, [fromServer, draftKey]);
  useEffect(() => { if (!fromServer && d.title) try { localStorage.setItem(draftKey, JSON.stringify({ ...d, _startedAt: startedAt.current })); } catch { /* */ } }, [d, fromServer, draftKey]);
  /** Po zveřejnění (i z úpravy konceptu) zapomeneme rozpracovanou kopii v prohlížeči, pokud patří k tomuto inzerátu. */
  function forgetLocal(id: string) {
    try {
      if (!fromServer) { localStorage.removeItem(draftKey); return; }
      const v = JSON.parse(localStorage.getItem(draftKey) ?? 'null');
      if (v?.id === id) localStorage.removeItem(draftKey);
    } catch { /* */ }
  }

  function validate(s: number): string | null {
    if (s === 0) {
      if (d.title.trim().length < 5) return 'Napište název (alespoň 5 znaků).';
      if (!d.subSlug) return 'Vyberte kategorii a podkategorii.';
      if (!sub) return 'Tato kategorie už není v nabídce. Vyberte prosím jinou.';
    }
    if (s === 1 && d.videoUrl.trim() && !parseVideoUrl(d.videoUrl)) return VIDEO_URL_ERROR;
    if (s === 2) {
      if (d.description.trim().length < 10) return 'Popis musí mít alespoň 10 znaků.';
      const p = cleanParams(fields, d.attributes, true); if (p.error) return p.error;
    }
    if (s === 3) { if (!d.city.trim()) return 'Zadejte lokalitu.'; if (d.zip && !/^\d{3}\s?\d{2}$/.test(d.zip)) return 'PSČ má 5 číslic.'; }
    return null;
  }
  const ready = [0, 1, 2, 3].every((s) => !validate(s));
  const canGo = (i: number) => i <= step || fromServer || [...Array(i).keys()].every((s) => !validate(s));
  function go(i: number) { setErr(null); setStep(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function next() { const e = validate(step); setErr(e); if (!e) go(step + 1); }
  function back() { go(Math.max(0, step - 1)); }

  async function submit(publish: boolean) {
    if (uploading) return;
    if (publish || live) {
      for (let s = 0; s < 4; s++) { const e = validate(s); if (e) { setStep(s); setErr(e); return; } }
    } else {
      if (!d.title.trim()) { setStep(0); setErr('Pro uložení konceptu napište název.'); return; }
      if (!d.subSlug || !sub) { setStep(0); setErr('Pro uložení konceptu vyberte kategorii a podkategorii.'); return; }
      if (d.videoUrl.trim() && !parseVideoUrl(d.videoUrl)) { setStep(1); setErr(VIDEO_URL_ERROR); return; }
    }
    setBusy(publish ? 'publish' : 'draft'); setErr(null);
    const free = d.offerType === 'GIVE';
    const body = {
      title: d.title, description: d.description, price: free ? null : d.price, priceNegotiable: free ? false : d.priceNegotiable, currency: d.currency,
      categorySlug: d.categorySlug, subSlug: d.subSlug, condition: d.condition, offerType: d.offerType, city: d.city, zip: d.zip, attributes: d.attributes,
      imageIds: d.images.map((i) => i.id), videoUrl: d.videoUrl.trim(), publish: live ? true : publish,
      ...(publish && isDraft ? { composeMs: Date.now() - startedAt.current } : {}),
    };
    try {
      type Res = { id: string; slug: string; status: string };
      let r: Res;
      if (d.id) {
        try { r = await send<Res>(`/listings/${d.id}`, 'PATCH', body); }
        catch (e) {
          // Koncept zapamatovaný v prohlížeči mezitím smazaný → založíme nový
          if (!(e instanceof SendError && e.status === 404 && !fromServer)) throw e;
          r = await send<Res>('/listings', 'POST', body);
        }
      } else r = await send<Res>('/listings', 'POST', body);

      if (!publish && !live) {
        setD((x) => ({ ...x, id: r.id, status: 'DRAFT' }));
        toast('Koncept uložen. Najdete ho v Můj účet › Moje inzeráty › Koncepty.');
        setBusy(null);
        return;
      }
      forgetLocal(r.id);
      toast(r.status === 'PENDING' ? 'Inzerát čeká na kontrolu moderátorem.' : live ? 'Změny uloženy' : 'Inzerát je zveřejněný!');
      router.push(`/muj-ucet/inzeraty?novy=${r.id}`); router.refresh();
    } catch (e) {
      const f = e instanceof SendError ? e.field : undefined;
      if (f && FIELD_STEP[f] !== undefined) setStep(FIELD_STEP[f]);
      setErr((e as Error).message); setBusy(null);
    }
  }

  const uploadingLabel = <><Loader2 className="size-4 animate-spin" />Nahrávám fotky…</>;
  const saveLabel = live ? (d.status === 'REJECTED' ? 'Odeslat ke kontrole' : 'Uložit změny') : 'Zveřejnit';
  const showDraft = isDraft && d.title.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-8 flex items-center gap-1.5" aria-label="Kroky">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-2">
            <button type="button" onClick={() => canGo(i) && go(i)} disabled={!canGo(i)} className={`h-1.5 rounded-full transition ${i <= step ? 'bg-brand' : 'bg-line'} ${canGo(i) ? 'cursor-pointer' : ''}`} aria-label={`${i + 1}. ${s}`} aria-current={i === step ? 'step' : undefined} />
            <span className={`hidden text-xs font-medium sm:block ${i === step ? 'text-ink' : 'text-muted'}`}>{i + 1}. {s}</span>
          </li>
        ))}
      </ol>
      <div className="mb-6 flex items-start justify-between gap-3">
        <h1 className="h-display text-3xl font-bold">{STEPS[step]}</h1>
        {showDraft && step < 4 && (
          <button type="button" onClick={() => submit(false)} disabled={!!busy || uploading > 0} className="btn btn-ghost btn-sm shrink-0 text-brand-ink">
            {busy === 'draft' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Uložit koncept
          </button>
        )}
      </div>
      {d.status === 'REJECTED' && step === 0 && (
        <div className="mb-6 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Inzerát byl zamítnut. Opravte ho a odešlete znovu ke kontrole.</div>
      )}
      {restored && step === 0 && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm">
          <span>Pokračujete v rozpracovaném inzerátu.</span>
          <button type="button" onClick={() => { try { localStorage.removeItem(draftKey); } catch { /* */ } setD({ ...EMPTY, city: defaultCity ?? '' }); setRestored(false); startedAt.current = Date.now(); }} className="font-semibold text-brand-ink hover:underline">Začít znovu</button>
        </div>
      )}

      {step === 0 && <StepBasics d={d} up={up} categories={categories} />}
      {step === 1 && <StepPhotos d={d} setD={setD} uploading={uploading} setUploading={setUploading} />}
      {step === 2 && <StepDetails d={d} up={up} fields={fields} />}
      {step === 3 && <StepPrice d={d} up={up} />}
      {step === 4 && <StepPreview d={d} categories={categories} />}

      {err && <p role="alert" className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{err}</p>}
      {ready && isDraft && step < 4 && !err && (
        <p className="mt-6 flex items-center gap-2 text-sm text-muted"><Check className="size-4 text-brand" />Máte vyplněno vše potřebné – můžete zveřejnit hned, nebo pokračovat a inzerát doladit.</p>
      )}

      <div className="sticky bottom-0 -mx-4 mt-8 flex items-center gap-2 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:gap-3 sm:border-0 sm:bg-transparent sm:px-0">
        {step > 0 && <button type="button" onClick={back} className="btn btn-ghost px-3" aria-label="Zpět"><ArrowLeft className="size-4" /><span className="hidden sm:inline">Zpět</span></button>}
        <div className="ml-auto flex gap-2">
          {step === 4 && showDraft && <button type="button" onClick={() => submit(false)} disabled={!!busy || uploading > 0} className="btn btn-outline">{busy === 'draft' ? <Loader2 className="size-4 animate-spin" /> : null}Uložit koncept</button>}
          {step < 4 && <button type="button" onClick={next} className={`btn ${ready || live ? 'btn-outline' : 'btn-dark'}`}>{step === 3 ? 'Náhled' : 'Pokračovat'}<ArrowRight className="size-4" /></button>}
          {(step === 4 || ready || live) && (
            <button type="button" onClick={() => submit(true)} disabled={!!busy || uploading > 0} className="btn btn-primary">
              {uploading > 0 ? uploadingLabel : <>{busy === 'publish' ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}{saveLabel}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type StepProps = { d: WizardInitial; up: (p: Partial<WizardInitial>) => void };

function StepBasics({ d, up, categories }: StepProps & { categories: WizardCategory[] }) {
  const [sugg, setSugg] = useState<{ parent: string; sub: string; name: string }[]>([]);
  const cat = categories.find((c) => c.slug === d.categorySlug);
  const sub = cat?.children.find((s) => s.slug === d.subSlug);
  const [pick, setPick] = useState(!sub);
  useEffect(() => {
    if (d.title.trim().length < 3) { setSugg([]); return; }
    const t = setTimeout(() => call<typeof sugg>(`/listings/suggest-category?title=${encodeURIComponent(d.title)}`).then(setSugg).catch(() => {}), 350);
    return () => clearTimeout(t);
  }, [d.title]);
  // Návrhy jen z kategorií, které jsou v nabídce (správce mohl kategorii vypnout)
  const shown = sugg.map((s) => { const c = categories.find((x) => x.slug === s.parent); const ch = c?.children.find((x) => x.slug === s.sub); return c && ch ? { c, ch } : null; }).filter((x) => !!x);
  const setOffer = (offerType: string) => up(offerType === 'GIVE' ? { offerType, price: null, priceNegotiable: false } : { offerType });
  return (
    <div className="space-y-6">
      <div>
        <label className="label" htmlFor="t">Název inzerátu</label>
        <input id="t" className="input h-13 text-lg" maxLength={90} autoFocus value={d.title} onChange={(e) => up({ title: e.target.value })} placeholder="Např. iPhone 15 Pro 256 GB, modrý" />
        <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted"><span>Napište značku, model a hlavní parametr – kupující to hledají.</span><span>{d.title.length}/90</span></div>
      </div>
      <div>
        <div className="label">Typ nabídky</div>
        <div className="flex flex-wrap gap-2">{OFFER_TYPES.map((o) => <button type="button" key={o.value} onClick={() => setOffer(o.value)} className={`chip h-10 px-4 ${d.offerType === o.value ? 'chip-active' : ''}`}>{o.label}</button>)}</div>
      </div>
      <div>
        <div className="label">Kategorie</div>
        {shown.length > 0 && pick && (
          <div className="mb-3 rounded-2xl border border-brand-soft bg-brand-soft/40 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-ink"><Sparkles className="size-4" />Doporučené podle názvu</div>
            <div className="flex flex-wrap gap-2">
              {shown.map(({ c, ch }) => <button type="button" key={`${c.slug}/${ch.slug}`} onClick={() => { up({ categorySlug: c.slug, subSlug: ch.slug, attributes: {} }); setPick(false); }} className="chip h-auto min-h-10 whitespace-normal bg-surface py-1.5 text-left">{c.name} › <b>{ch.name}</b></button>)}
            </div>
          </div>
        )}
        {sub && !pick ? (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><CategoryIcon name={cat!.icon ?? 'shapes'} className="size-5" /></span>
            <div className="min-w-0 flex-1"><div className="text-sm text-muted">{cat!.name}</div><div className="font-semibold">{sub.name}</div></div>
            <button type="button" onClick={() => setPick(true)} className="btn btn-ghost btn-sm">Změnit</button>
          </div>
        ) : (
          <>
            {d.subSlug && !sub && <p className="mb-2 text-sm text-danger">Původní kategorie už není v nabídce. Vyberte prosím jinou.</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <select className="input" value={cat ? d.categorySlug : ''} onChange={(e) => up({ categorySlug: e.target.value, subSlug: '', attributes: {} })} aria-label="Kategorie">
                <option value="">Vyberte kategorii</option>
                {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
              </select>
              <select className="input" value={sub ? d.subSlug : ''} disabled={!cat} onChange={(e) => { up({ subSlug: e.target.value }); if (e.target.value) setPick(false); }} aria-label="Podkategorie">
                <option value="">Podkategorie</option>
                {cat?.children.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepPhotos({ d, setD, uploading, setUploading }: { d: WizardInitial; setD: React.Dispatch<React.SetStateAction<WizardInitial>>; uploading: number; setUploading: React.Dispatch<React.SetStateAction<number>> }) {
  const [drag, setDrag] = useState(false);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const setImages = (fn: (imgs: WizardInitial['images']) => WizardInitial['images']) => setD((x) => ({ ...x, images: fn(x.images) }));

  async function add(files: FileList | File[]) {
    const all = [...files];
    const list = all.filter(isImageFile).slice(0, Math.max(0, 20 - d.images.length - uploading));
    if (all.length > list.length) toast(all.some((f) => !isImageFile(f)) ? 'Některé soubory nejsou fotky – podporujeme JPG, PNG, WebP a HEIC.' : 'Nejvýše 20 fotek.', 'error');
    setUploading((n) => n + list.length);
    // Nahrávání běží v průvodci dál, i když uživatel mezitím přejde na další krok
    await Promise.all(list.map(async (f) => {
      try {
        const file = await shrinkImage(f);
        if (file.size > MAX_UPLOAD_BYTES) throw new Error('Fotka je příliš velká (nejvýše 4 MB). Zkuste ji zmenšit.');
        const fd = new FormData(); fd.append('file', file);
        const r = await call<{ id: string; url: string; thumbUrl: string }>('/media/image', 'POST', fd);
        setImages((imgs) => (imgs.length >= 20 ? imgs : [...imgs, r]));
      } catch (e) { toast(`${f.name}: ${(e as Error).message}`, 'error'); }
      finally { setUploading((n) => n - 1); }
    }));
  }
  const move = (i: number, dir: number) => setImages((imgs) => { const a = [...imgs]; const j = i + dir; if (j < 0 || j >= a.length) return imgs; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const video = d.videoUrl.trim() ? parseVideoUrl(d.videoUrl) : null;

  return (
    <div className="space-y-6">
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-brand bg-brand-soft' : 'border-line bg-surface'}`}>
        <ImagePlus className="size-10 text-muted" strokeWidth={1.5} />
        <div><div className="font-semibold">Přetáhněte fotky sem</div><div className="text-sm text-muted">až 20 fotek · JPG, PNG, WebP i HEIC z iPhonu · velké fotky zmenšíme</div></div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => input.current?.click()} className="btn btn-dark btn-sm">Vybrat fotky</button>
          <button type="button" onClick={() => camera.current?.click()} className="btn btn-outline btn-sm sm:hidden"><Camera className="size-4" />Vyfotit</button>
        </div>
        <input ref={input} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
      </div>
      {(d.images.length > 0 || uploading > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {d.images.map((im, i) => (
            <li key={im.id} className="group relative overflow-hidden rounded-2xl border border-line bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.thumbUrl} alt="" className="aspect-[4/3] w-full object-cover" />
              {i === 0 && <span className="badge absolute left-2 top-2 bg-ink text-paper"><Star className="size-3" />Hlavní</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 p-1.5">
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="grid size-8 place-items-center rounded-lg bg-white/90 text-ink disabled:opacity-40" aria-label="Posunout dopředu"><ChevronLeft className="size-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === d.images.length - 1} className="grid size-8 place-items-center rounded-lg bg-white/90 text-ink disabled:opacity-40" aria-label="Posunout dozadu"><ChevronRight className="size-4" /></button>
                </div>
                <button type="button" onClick={() => setImages((imgs) => imgs.filter((x) => x.id !== im.id))} className="grid size-8 place-items-center rounded-lg bg-white/90 text-danger" aria-label="Smazat fotku"><Trash2 className="size-4" /></button>
              </div>
            </li>
          ))}
          {Array.from({ length: uploading }).map((_, i) => <li key={`u${i}`} className="grid aspect-[4/3] place-items-center rounded-2xl border border-line bg-surface-2"><Loader2 className="size-6 animate-spin text-muted" /></li>)}
        </ul>
      )}
      <p className="flex items-start gap-2 text-sm text-muted"><Lightbulb className="mt-0.5 size-4 shrink-0 text-top" />Inzeráty s 5 a více fotkami při denním světle dostávají výrazně víc zpráv. Z fotek automaticky odstraníme polohu GPS.</p>
      <div>
        <label className="label" htmlFor="v">Video (nepovinné)</label>
        <input id="v" className="input" inputMode="url" placeholder="Odkaz na YouTube nebo Vimeo" value={d.videoUrl} onChange={(e) => setD((x) => ({ ...x, videoUrl: e.target.value }))} aria-invalid={!!d.videoUrl.trim() && !video} aria-describedby="v-help" />
        {d.videoUrl.trim() && !video
          ? <p id="v-help" className="mt-1.5 text-sm text-danger">{VIDEO_URL_ERROR}</p>
          : <p id="v-help" className="mt-1.5 text-xs text-muted">Funguje i odkaz na Shorts nebo z mobilní aplikace.</p>}
        {video && <VideoFrame src={video.embed} className="mt-3" />}
      </div>
    </div>
  );
}

function VideoFrame({ src, className = '' }: { src: string; className?: string }) {
  return <iframe src={src} title="Náhled videa" className={`aspect-video w-full rounded-2xl border border-line bg-surface-2 ${className}`} allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />;
}

function StepDetails({ d, up, fields }: StepProps & { fields: FilterDef[] }) {
  const filters = fields;
  const setA = (k: string, v: unknown) => up({ attributes: { ...d.attributes, [k]: v } });
  function draft() {
    const parts = filters.map((f) => { const v = d.attributes[f.key]; if (v === undefined || v === '' || v === false) return null; return `• ${f.label}: ${f.type === 'boolean' ? 'ano' : Array.isArray(v) ? v.join(', ') : v}${f.unit ? ` ${f.unit}` : ''}`; }).filter(Boolean);
    const cond = d.condition ? { NEW: 'Zboží je nové, nepoužité.', LIKE_NEW: 'Ve stavu jako nové, bez viditelných známek používání.', USED: 'Používané, plně funkční, s běžnými stopami používání.', DAMAGED: 'Poškozené – vhodné na opravu nebo na díly.' }[d.condition] : '';
    const text = `${d.offerType === 'BUY' ? 'Koupím' : d.offerType === 'RENT' ? 'Pronajmu' : d.offerType === 'GIVE' ? 'Daruji' : 'Nabízím'} ${d.title}.\n\n${cond}\n${parts.length ? `\nParametry:\n${parts.join('\n')}\n` : ''}\n${d.offerType === 'GIVE' ? '' : 'Důvod prodeje: …\n'}V balení / příslušenství: …\n\nOsobní předání${d.city ? ` v lokalitě ${d.city}` : ''}, případně zašlu.${d.offerType === 'SELL' ? ' Při rychlém jednání možná sleva.' : ''}`;
    up({ description: text.replace(/\n{3,}/g, '\n\n') });
  }
  return (
    <div className="space-y-6">
      <PriceFields d={d} up={up} />
      {!['GIVE'].includes(d.offerType) && (
        <div>
          <div className="label">Stav</div>
          <div className="flex flex-wrap gap-2">{CONDITIONS.map((c) => <button type="button" key={c.value} onClick={() => up({ condition: d.condition === c.value ? null : c.value })} className={`chip h-10 px-4 ${d.condition === c.value ? 'chip-active' : ''}`}>{c.label}</button>)}</div>
        </div>
      )}
      {filters.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {filters.map((f) => {
            const v = d.attributes[f.key];
            if (f.type === 'boolean') return <label key={f.key} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 sm:col-span-1"><input type="checkbox" className="size-5 accent-[var(--brand)]" checked={v === true} onChange={(e) => setA(f.key, e.target.checked)} />{f.label}</label>;
            if (f.type === 'range') return <div key={f.key}><label className="label" htmlFor={`a-${f.key}`}>{f.label}{f.unit ? ` (${f.unit})` : ''}</label><input id={`a-${f.key}`} inputMode="numeric" className="input" value={(v as number | undefined) ?? ''} onChange={(e) => setA(f.key, e.target.value === '' ? undefined : Number(e.target.value.replace(/\D/g, '')))} placeholder={f.min != null && f.max != null ? `${f.min}–${f.max}` : undefined} /></div>;
            if (f.type === 'multiselect' && f.options?.length) {
              const arr = Array.isArray(v) ? (v as string[]) : v ? [String(v)] : [];
              return <div key={f.key} className="sm:col-span-2"><div className="label">{f.label}</div><div className="flex flex-wrap gap-2">{f.options.map((o) => <button type="button" key={o} onClick={() => setA(f.key, arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])} className={`chip h-9 ${arr.includes(o) ? 'chip-active' : ''}`}>{o}</button>)}</div></div>;
            }
            if (!f.options?.length) return <div key={f.key}><label className="label" htmlFor={`a-${f.key}`}>{f.label}</label><input id={`a-${f.key}`} className="input" maxLength={120} value={(v as string | undefined) ?? ''} onChange={(e) => setA(f.key, e.target.value || undefined)} /></div>;
            return <div key={f.key}><label className="label" htmlFor={`a-${f.key}`}>{f.label}</label><select id={`a-${f.key}`} className="input" value={(v as string | undefined) ?? ''} onChange={(e) => setA(f.key, e.target.value || undefined)}><option value="">Nevyplněno</option>{f.options.map((o) => <option key={o}>{o}</option>)}</select></div>;
          })}
        </div>
      )}
      <div>
        <div className="flex items-end justify-between gap-3">
          <label className="label" htmlFor="desc">Popis</label>
          <button type="button" onClick={draft} className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline"><Wand2 className="size-4" />Navrhnout popis</button>
        </div>
        <textarea id="desc" className="input min-h-44" maxLength={8000} value={d.description} onChange={(e) => up({ description: e.target.value })} placeholder="Popište stav, stáří, důvod prodeje, co je v balení a jak předáte zboží." />
        <div className="mt-1.5 text-right text-xs text-muted">{d.description.length}/8000</div>
      </div>
    </div>
  );
}

function PriceFields({ d, up }: StepProps) {
  const [sugg, setSugg] = useState<{ sample: number; median: number | null; low?: number; high?: number } | null>(null);
  const free = d.offerType === 'GIVE';
  useEffect(() => { if (free) return; call<typeof sugg>(`/listings/price-suggestion?title=${encodeURIComponent(d.title)}&kategorie=${d.categorySlug}&pod=${d.subSlug}`).then(setSugg).catch(() => {}); }, [d.title, d.categorySlug, d.subSlug, free]);
  if (free) return <div className="rounded-2xl border border-line bg-surface p-4"><div className="label mb-0">Cena</div><div className="text-2xl font-bold">Zdarma</div><div className="text-sm text-muted">Darujete – cenu nezadáváte.</div></div>;
  return (
    <div>
      <label className="label" htmlFor="price">Cena</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input id="price" inputMode="numeric" className="input h-13 pr-14 text-lg font-semibold" value={d.price == null ? '' : new Intl.NumberFormat('cs-CZ').format(d.price)} onChange={(e) => { const n = e.target.value.replace(/\D/g, ''); up({ price: n === '' ? null : Math.min(2_000_000_000, Number(n)) }); }} placeholder="0" />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted">{d.currency === 'EUR' ? '€' : 'Kč'}</span>
        </div>
        <select className="input h-13 w-24" value={d.currency} onChange={(e) => up({ currency: e.target.value as 'CZK' | 'EUR' })} aria-label="Měna"><option value="CZK">Kč</option><option value="EUR">€</option></select>
      </div>
      <label className="mt-3 flex items-center gap-3 text-[15px]"><input type="checkbox" className="size-5 accent-[var(--brand)]" checked={d.priceNegotiable} onChange={(e) => up({ priceNegotiable: e.target.checked })} />Cena dohodou / k jednání</label>
      {sugg?.median && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-brand" />Doporučená cena podle {sugg.sample} podobných nabídek</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3"><span className="text-2xl font-bold">{fmtPrice(sugg.median)}</span><span className="text-sm text-muted">obvykle {fmtPrice(sugg.low!)} – {fmtPrice(sugg.high!)}</span></div>
          <button type="button" onClick={() => up({ price: sugg.median })} className="btn btn-outline btn-sm mt-3">Použít doporučenou cenu</button>
        </div>
      )}
    </div>
  );
}

function StepPrice({ d, up }: StepProps) {
  return (
    <div className="space-y-6">
      <LocationFields city={d.city} zip={d.zip} onChange={up} />
    </div>
  );
}

function StepPreview({ d, categories }: { d: WizardInitial; categories: WizardCategory[] }) {
  const cat = categories.find((c) => c.slug === d.categorySlug);
  const sub = cat?.children.find((s) => s.slug === d.subSlug);
  const video = parseVideoUrl(d.videoUrl);
  return (
    <div className="card overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {d.images[0] ? <img src={d.images[0].url} alt="" className="aspect-[16/9] w-full object-cover" /> : <div className="grid aspect-[16/9] place-items-center bg-surface-2 px-6 text-center text-muted">Bez fotografií – inzeráty s fotkou mají mnohem víc zájemců</div>}
      <div className="space-y-3 p-6">
        <div className="text-sm text-muted">{cat?.name} › {sub?.name}</div>
        <h2 className="h-display text-2xl font-bold">{d.title}</h2>
        <div className="text-2xl font-bold">{d.offerType === 'GIVE' ? 'Zdarma' : fmtPrice(d.price, d.priceNegotiable, d.currency)}</div>
        <div className="flex flex-wrap gap-2 text-sm"><span className="inline-flex items-center gap-1"><MapPin className="size-4 text-muted" />{d.city}</span>{d.condition && <span className="rounded-md bg-surface-2 px-2">{CONDITION_LABEL[d.condition]}</span>}<span className="text-muted">· {d.images.length} fotek</span></div>
        <p className="whitespace-pre-line border-t border-line pt-3 text-ink-2">{d.description}</p>
        {video && <VideoFrame src={video.embed} />}
      </div>
    </div>
  );
}
