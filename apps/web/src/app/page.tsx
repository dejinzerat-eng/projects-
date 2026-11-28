import Link from 'next/link';
import { Plus, Zap } from 'lucide-react';
import { HomeSection as Section } from '@/components/home-section';
import { CategoryTile } from '@/components/icons';
import { ListingGrid } from '@/components/listing-card';
import { HomeBanners, type Banner } from '@/components/home-banners';
import { RecommendedListings } from '@/components/recommended-listings';
import { SearchBox } from '@/components/search-box';
import { api, getMe } from '@/lib/api';
import { getFavoriteIds } from '@/lib/favorites';
import type { Category, ListingCard } from '@/lib/types';
import type { Metadata } from 'next';
import { JsonLd } from '@/components/json-ld';
import { organization, website } from '@/lib/jsonld';
import { getOperator } from '@/lib/operator';
import { HOME_DESCRIPTION, HOME_TITLE, social } from '@/lib/seo';

// Kanonická adresa bez parametrů (varianta ?ikony=b je jen náhled). Titulek a popis lze upravit ve Správě SEO.
export async function generateMetadata(): Promise<Metadata> {
  const s = await api<{ homeTitle?: unknown; homeDescription?: unknown }>('/settings/public', { revalidate: 300, auth: false }).catch(() => null);
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const title = text(s?.homeTitle) ?? HOME_TITLE, description = text(s?.homeDescription);
  return {
    title: { absolute: title },
    ...(description ? { description } : {}),
    alternates: { canonical: '/' },
    ...social({ title, description: description ?? HOME_DESCRIPTION, path: '/' }),
  };
}

const POPULAR = ['iPhone 15', 'Byt 2+kk Praha', 'Kočárek', 'Horské kolo do 15 000 Kč', 'Škoda Octavia'];

export default async function Home({ searchParams }: { searchParams: Promise<{ ikony?: string }> }) {
  const variant = (await searchParams).ikony === 'b' ? 'solid' : 'soft';
  const [cats, premium, featured, latest, me, favorites, operator, banners] = await Promise.all([
    api<Category[]>('/categories', { revalidate: 60, auth: false }).catch(() => [] as Category[]),
    api<ListingCard[]>('/search/premium?limit=8', { auth: false }).catch(() => [] as ListingCard[]),
    api<ListingCard[]>('/listings/featured?limit=8', { auth: false }).catch(() => [] as ListingCard[]),
    api<ListingCard[]>('/listings/latest?limit=12', { auth: false }).catch(() => [] as ListingCard[]),
    getMe(),
    getFavoriteIds(),
    getOperator(),
    api<Banner[]>('/banners', { revalidate: 30, auth: false }).catch(() => [] as Banner[]),
  ]);
  const popularCats = [...cats].sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <>
      <JsonLd data={[website(), organization(operator)]} />
      {/* Kompaktní úvod: nadpis na jednom řádku, hledání včetně lokality (dříve sekce „Nabídky v okolí“) a tipy. */}
      <section className="border-b border-line bg-surface">
        <div className="container-x py-4 sm:py-5">
          <div className="mx-auto flex max-w-3xl flex-wrap items-baseline justify-center gap-x-2 text-center">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Co hledáte?</h1>
            <p className="hidden text-sm text-muted sm:block">Inzeráty z celé České republiky. Vložení zdarma.</p>
          </div>
          <div className="mx-auto mt-3 max-w-3xl"><SearchBox size="lg" withLocation /></div>
          <div className="mx-auto mt-2.5 flex max-w-3xl justify-start gap-1.5 overflow-x-auto scrollbar-none sm:justify-center">
            {POPULAR.map((p) => <Link key={p} href={`/hledat?q=${encodeURIComponent(p)}&chytre=1`} className="chip h-7 shrink-0 px-2.5 text-[13px]">{p}</Link>)}
          </div>
        </div>
      </section>

      <Section id="kat" title="Kategorie" compact>
        <div className="grid grid-cols-4 gap-x-2 gap-y-5 sm:grid-cols-5 lg:grid-cols-10">
          {cats.map((c) => (
            <Link key={c.slug} href={`/kategorie/${c.slug}`} className="group flex flex-col items-center gap-2 text-center">
              <CategoryTile slug={c.slug} icon={c.icon} variant={variant} />
              <span className="text-[12.5px] leading-tight text-ink-2 group-hover:text-ink">{c.name}</span>
            </Link>
          ))}
        </div>
      </Section>

      {premium.length > 0 && (
        <Section id="premium" title="Prémiové a zvýrazněné nabídky" subtitle={<span className="inline-flex items-center gap-1"><Zap className="size-3.5 text-top" />Topované a zvýrazněné inzeráty</span>}>
          <ListingGrid items={premium} favorites={favorites} />
        </Section>
      )}

      {featured.length > 0 && (
        <Section id="dop" title="Doporučené nabídky" subtitle="Čerstvé nabídky ověřených prodejců a firem" href="/hledat">
          <ListingGrid items={featured} favorites={favorites} />
        </Section>
      )}

      {/* Reklamní bannery (správa: Administrace › Reklamní bannery) – bez aktivních se řada nezobrazí */}
      <HomeBanners banners={banners} />

      <RecommendedListings loggedIn={!!me} />

      <Section id="nove" title="Nejnovější nabídky" href="/hledat?razeni=newest">
        {latest.length ? <ListingGrid items={latest} favorites={favorites} /> : <p className="card p-8 text-center text-muted">Zatím tu nejsou žádné inzeráty. Buďte první.</p>}
      </Section>

      {popularCats.length > 0 && (
        <Section id="obl" title="Oblíbené kategorie">
          <div className="flex flex-wrap gap-2">
            {popularCats.map((c) => <Link key={c.slug} href={`/kategorie/${c.slug}`} className="chip">{c.name}<span className="text-muted">{c.count}</span></Link>)}
          </div>
        </Section>
      )}

      <section className="container-x pt-16">
        <div className="card flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Máte něco na prodej?</h2>
            <p className="mt-1 text-muted">Inzerát vložíte do minuty. {me ? '' : 'Stačí se zaregistrovat e-mailem nebo přes Google.'}</p>
          </div>
          <div className="flex gap-2">
            {!me && <Link href="/registrace" className="btn btn-outline">Registrovat</Link>}
            <Link href="/pridat" className="btn btn-primary"><Plus className="size-4" strokeWidth={2.5} />Přidat inzerát</Link>
          </div>
        </div>
      </section>
    </>
  );
}
