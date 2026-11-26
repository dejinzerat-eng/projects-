import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BadgeCheck, Building2, CalendarDays, Check, ExternalLink, MapPin, Star, X } from 'lucide-react';
import { Avatar } from '@/components/avatar';
import { FollowButton } from '@/components/follow-button';
import { ListingGrid } from '@/components/listing-card';
import { ReportButton } from '@/components/report-button';
import { api } from '@/lib/api';
import { getFavoriteIds } from '@/lib/favorites';
import { ago, plural } from '@/lib/format';
import type { ListingCard } from '@/lib/types';
import { OfferHistory, type HistoryPage } from './offer-history';

interface Company { verified: boolean; name: string | null; ico: string | null; vatId: string | null; address: string | null; verifiedAt: string | null; aresUrl: string | null }
interface Profile {
  id: string; name: string; avatarUrl: string | null; bio: string | null; city: string | null; createdAt: string; lastSeenAt: string | null;
  phoneVerified: boolean; emailVerified: boolean; isBusiness: boolean; companyName: string | null; company: Company | null;
  rating: number | null; reviewCount: number; ratingDistribution: Record<string, number>; reviews: { id: string; rating: number; text: string | null; createdAt: string; author: { name: string } }[];
  soldCount: number; followers: number; isFollowing: boolean; trust: number; trustBreakdown: { label: string; ok: boolean }[]; listings: ListingCard[]; history: HistoryPage;
}
type Props = { params: Promise<{ id: string }> };
const load = (id: string) => api<Profile>(`/users/${id}`).catch(() => notFound());

const MONTHS_GEN = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
/** „listopadu 2026“ – měsíc ve 2. pádě pro větu „Na Dejinzeratu od …“ */
const since = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Prague', month: 'numeric', year: 'numeric' }).formatToParts(new Date(iso));
  const get = (t: string) => Number(parts.find((x) => x.type === t)?.value);
  return `${MONTHS_GEN[get('month') - 1]} ${get('year')}`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).id);
  return { title: `${p.companyName ?? p.name} – inzeráty a hodnocení`, description: `${p.listings.length} aktivních inzerátů, hodnocení ${p.rating?.toFixed(1) ?? '–'} z 5.` };
}

function Verification({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <li className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-trust-soft text-trust' : 'bg-surface-2 text-muted'}`}>
      {ok ? <BadgeCheck className="size-3.5" /> : <X className="size-3.5" />}{ok ? yes : no}
    </li>
  );
}

export default async function Page({ params }: Props) {
  const p = await load((await params).id);
  const name = p.companyName ?? p.name;
  const c = p.company;
  return (
    <div className="container-x py-6 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="min-w-0 space-y-4">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <Avatar name={name} url={p.avatarUrl} size={72} />
              <div className="min-w-0">
                <h1 className="h-display flex items-center gap-1.5 text-2xl font-bold"><span className="truncate">{name}</span>{p.phoneVerified && <BadgeCheck className="size-5 shrink-0 text-trust" aria-label="Ověřený" />}</h1>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
                  {p.isBusiness && <span className="inline-flex items-center gap-1"><Building2 className="size-4" />Firma</span>}
                  {p.city && <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{p.city}</span>}
                </div>
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted"><CalendarDays className="size-4" />Na Dejinzeratu od {since(p.createdAt)}</p>
              </div>
            </div>
            <h2 className="sr-only">Stav ověření</h2>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              <Verification ok={p.emailVerified} yes="E-mail ověřen" no="E-mail neověřen" />
              <Verification ok={p.phoneVerified} yes="Telefon ověřen" no="Telefon neověřen" />
              {c && <Verification ok={c.verified} yes="IČO ověřeno v ARES" no="IČO neověřeno" />}
            </ul>
            {p.bio && <p className="mt-4 text-[15px] text-ink-2">{p.bio}</p>}
            <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-surface-2 p-2.5"><dt className="text-xs text-muted">Hodnocení</dt><dd className="font-bold">{p.rating ? `${p.rating.toFixed(1)} ★` : '–'}</dd></div>
              <div className="rounded-xl bg-surface-2 p-2.5"><dt className="text-xs text-muted">Prodáno</dt><dd className="font-bold">{p.soldCount}</dd></div>
              <div className="rounded-xl bg-surface-2 p-2.5"><dt className="text-xs text-muted">Sledující</dt><dd className="font-bold">{p.followers}</dd></div>
            </dl>
            <div className="mt-5 flex items-center justify-between gap-2"><FollowButton id={p.id} initial={p.isFollowing} /><ReportButton targetType="USER" targetId={p.id} label="Nahlásit" /></div>
            {p.lastSeenAt && <p className="mt-3 text-xs text-muted">Naposledy aktivní {ago(p.lastSeenAt)}</p>}
          </div>
          {c && (
            <div className="card p-5 sm:p-6">
              <h2 className="flex items-center gap-2 font-bold"><Building2 className="size-5 text-muted" />Firemní údaje</h2>
              {c.verified ? <>
                <dl className="mt-3 space-y-2 text-sm">
                  <div><dt className="text-muted">Obchodní jméno</dt><dd className="font-semibold">{c.name}</dd></div>
                  <div className="flex gap-6"><div><dt className="text-muted">IČO</dt><dd className="font-semibold tabular-nums">{c.ico}</dd></div>{c.vatId && <div><dt className="text-muted">DIČ</dt><dd className="font-semibold tabular-nums">{c.vatId}</dd></div>}</div>
                  {c.address && <div><dt className="text-muted">Sídlo</dt><dd>{c.address}</dd></div>}
                </dl>
                {c.aresUrl && <a href={c.aresUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-trust hover:underline">Ověřit v registru ARES<ExternalLink className="size-3.5" /></a>}
              </> : <p className="mt-2 text-sm text-muted">Údaje firmy zatím nejsou ověřené v obchodním registru ARES.</p>}
            </div>
          )}
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between"><h2 className="font-bold">Skóre důvěryhodnosti</h2><span className="text-2xl font-bold text-trust">{p.trust}<span className="text-sm font-medium text-muted">/100</span></span></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-trust" style={{ width: `${p.trust}%` }} /></div>
            <ul className="mt-4 space-y-2 text-sm">{p.trustBreakdown.map((t) => <li key={t.label} className="flex items-center gap-2">{t.ok ? <Check className="size-4 shrink-0 text-trust" /> : <X className="size-4 shrink-0 text-muted" />}<span className={t.ok ? '' : 'text-muted'}>{t.label}</span></li>)}</ul>
            <p className="mt-4 text-xs text-muted">Skóre počítáme jen z ověřitelných údajů. Hodnotit může pouze ten, kdo s prodejcem skutečně komunikoval.</p>
          </div>
        </aside>
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="h-display mb-4 text-2xl font-bold">{plural(p.listings.length, 'aktivní inzerát', 'aktivní inzeráty', 'aktivních inzerátů')}</h2>
            {p.listings.length ? <ListingGrid items={p.listings} favorites={await getFavoriteIds()} /> : <p className="text-muted">Žádné aktivní inzeráty.</p>}
          </section>
          <section>
            <h2 className="h-display text-2xl font-bold">Historie nabídek{p.history.total > 0 && <span className="text-muted"> ({p.history.total})</span>}</h2>
            <p className="mb-4 mt-1 text-sm text-muted">Prodané a ukončené inzeráty. Tyto nabídky už nejsou k dispozici.</p>
            <OfferHistory userId={p.id} initial={p.history} />
          </section>
          <section>
            <h2 className="h-display mb-4 text-2xl font-bold">Hodnocení ({p.reviewCount})</h2>
            {p.reviews.length ? (
              <ul className="space-y-3">{p.reviews.map((r) => (
                <li key={r.id} className="card p-4"><div className="flex items-center justify-between"><span className="font-semibold">{r.author.name}</span><span className="text-xs text-muted">{ago(r.createdAt)}</span></div>
                  <div className="mt-1 flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`size-4 ${n <= r.rating ? 'fill-top text-top' : 'text-line'}`} />)}</div>
                  {r.text && <p className="mt-2 text-[15px] text-ink-2">{r.text}</p>}</li>
              ))}</ul>
            ) : <p className="text-muted">Zatím bez hodnocení.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
