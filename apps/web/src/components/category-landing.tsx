import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Info } from 'lucide-react';
import type { City } from '@dej/shared';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import { breadcrumbs, itemList } from '@/lib/jsonld';
import { redirectOrNotFound } from '@/lib/redirects';
import { cityBySlug, citySlug, hasFilters, listCanonical, social, TOP_CITIES } from '@/lib/seo';
import type { Category, SearchResult } from '@/lib/types';
import { JsonLd } from './json-ld';
import { Markdown } from './markdown';
import { SearchView } from './search-view';

/**
 * Vstupní stránky kategorií a lokalit: metadata, strukturovaná data, úvodní text a odkazy na města.
 * Výpis samotný kreslí SearchView – tady jen doplňujeme SEO části kolem.
 */
export type SP = Record<string, string | string[] | undefined>;
export interface Landing { cat?: Category; sub?: Category['children'][number]; city?: City; path: string }

export const loadCategories = () => api<Category[]>('/categories', { revalidate: 60, auth: false });

export async function resolveLanding(p: { slug?: string; sub?: string; city?: string }): Promise<Landing> {
  const cats = p.slug ? await loadCategories() : [];
  const cat = p.slug ? cats.find((c) => c.slug === p.slug) : undefined;
  const sub = cat && p.sub ? cat.children.find((s) => s.slug === p.sub) : undefined;
  const city = p.city ? cityBySlug(p.city) : undefined;
  const path = `${p.slug ? `/kategorie/${p.slug}${p.sub ? `/${p.sub}` : ''}` : ''}${p.city ? `${p.slug ? '/mesto' : '/lokalita'}/${p.city}` : ''}`;
  if ((p.slug && !cat) || (p.sub && !sub) || (p.city && !city)) await redirectOrNotFound(path);
  return { cat, sub, city, path };
}

/** Parametry pro výpis – stejné, jaké sestaví SearchView, aby se požadavek na API v rámci renderu sdílel. */
function listingParams(l: Landing, sp: SP): SP {
  const { odstraneno: _o, ...rest } = sp;
  return l.city ? { ...rest, mesto: l.city.name } : rest;
}
function search(l: Landing, sp: SP) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(listingParams(l, sp))) if (typeof v === 'string') qs.set(k, v);
  if (l.cat) qs.set('kategorie', l.cat.slug);
  if (l.sub) qs.set('pod', l.sub.slug);
  return api<SearchResult>(`/search?${qs}`, { auth: false }).catch(() => null);
}

const pageNo = (sp: SP) => { const n = Number(Array.isArray(sp.strana) ? sp.strana[0] : sp.strana); return Number.isInteger(n) && n > 1 ? n : 1; };

export async function landingMetadata(l: Landing, sp: SP): Promise<Metadata> {
  const { cat, sub, city } = l;
  const name = sub?.name ?? cat?.name;
  const n = pageNo(sp);
  const res = city || n > 1 ? await search(l, sp) : null;
  const count = res?.total ?? sub?.count ?? cat?.count ?? 0;
  let title: string, description: string;
  if (city && name) {
    title = `${name} ${city.name} – inzeráty a bazar | DEJINZERAT.cz`;
    description = `${name} v lokalitě ${city.name}: ${plural(count, 'aktuální nabídka', 'aktuální nabídky', 'aktuálních nabídek')} od soukromých inzerentů i firem. Inzerujte zdarma na DEJINZERAT.cz.`;
  } else if (city) {
    title = `Inzeráty ${city.name} – bazar a inzerce zdarma | DEJINZERAT.cz`;
    description = `Aktuální inzeráty z lokality ${city.name}: ${plural(count, 'nabídka', 'nabídky', 'nabídek')} – auta, reality, elektronika, nábytek, práce a služby. Inzerce zdarma.`;
  } else {
    const s = sub ?? cat!;
    title = s.seoTitle ?? (sub ? `${sub.name} – ${cat!.name} | DEJINZERAT.cz` : `${cat!.name} – inzeráty z celé ČR | DEJINZERAT.cz`);
    description = s.seoDescription ?? `Inzeráty v kategorii ${name} z celé ČR – ${plural(count, 'nabídka', 'nabídky', 'nabídek')} od soukromých inzerentů i firem. Rychlé hledání, bezpečná komunikace a inzerce zdarma.`;
  }
  // Vlastní SEO titulek z administrace nemusí končit značkou – číslo strany doplníme vždy (jinak duplicitní titulky)
  if (n > 1) title = / \| DEJINZERAT\.cz$/i.test(title) ? title.replace(/ \| DEJINZERAT\.cz$/i, ` – strana ${n} | DEJINZERAT.cz`) : `${title} – strana ${n}`;
  if (n > 1) description = `Strana ${n}. ${description}`;
  const canonical = listCanonical(l.path, sp.strana);
  // Kombinace filtrů a prázdné lokality neindexujeme (odkazy ale sledujeme)
  const noindex = hasFilters(sp, city ? ['odstraneno', 'mesto'] : ['odstraneno']) || (city && count === 0) || (res && n > 1 && n > res.pages);
  return {
    title: { absolute: title }, description, alternates: { canonical },
    robots: noindex ? { index: false, follow: true } : undefined,
    ...social({ title, description, path: canonical }),
  };
}

export async function LandingPage({ landing: l, searchParams: sp }: { landing: Landing; searchParams: SP }) {
  const { cat, sub, city } = l;
  const [res, intro, cities] = await Promise.all([
    search(l, sp),
    cat && !city && pageNo(sp) === 1 ? api<{ intro: string | null }>(`/seo/category?slug=${cat.slug}${sub ? `&sub=${sub.slug}` : ''}`, { revalidate: 60, auth: false }).then((r) => r.intro).catch(() => null) : Promise.resolve(null),
    api<{ city: string; count: number }[]>(`/seo/cities${cat ? `?kategorie=${cat.slug}${sub ? `&pod=${sub.slug}` : ''}` : ''}`, { revalidate: 300, auth: false }).catch(() => []),
  ]);
  // Jiné město ve filtru na stránce lokality → obecné hledání se stejnými filtry
  const asked = typeof sp.mesto === 'string' ? sp.mesto : undefined;
  if (city && asked && asked !== city.name) {
    const qs = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string'));
    if (cat) qs.set('kategorie', cat.slug);
    if (sub) qs.set('pod', sub.slug);
    redirect(`/hledat?${qs}`);
  }
  const crumbs = [{ name: 'Domů', path: '/' }];
  if (cat) crumbs.push({ name: cat.name, path: `/kategorie/${cat.slug}` });
  if (sub) crumbs.push({ name: sub.name, path: `/kategorie/${cat!.slug}/${sub.slug}` });
  if (city) crumbs.push({ name: city.name, path: l.path });
  const counts = new Map(cities.map((c) => [c.city, c.count]));
  const top = TOP_CITIES.filter((c) => counts.get(c) && c !== city?.name).slice(0, 16);
  const base = cat ? `/kategorie/${cat.slug}${sub ? `/${sub.slug}` : ''}/mesto` : '/lokalita';
  const title = city ? ((sub ?? cat) ? `${(sub ?? cat)!.name} ${city.name}` : `Inzeráty ${city.name}`) : null;
  const n = pageNo(sp);

  return (
    <>
      <JsonLd data={[breadcrumbs(crumbs), ...(res?.hits.length ? [itemList(res.hits, (n - 1) * 24 + 1)] : [])]} />
      {sp.odstraneno && (
        <div className="container-x pt-6">
          <p className="flex items-start gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-2" role="status"><Info className="mt-0.5 size-4 shrink-0 text-muted" />Inzerát, který jste hledali, už není dostupný. Podívejte se na podobné nabídky v této kategorii.</p>
        </div>
      )}
      <SearchView searchParams={listingParams(l, sp)} category={cat?.slug} sub={sub?.slug} basePath={l.path} heading={title ?? undefined} crumbs={city ? crumbs : undefined} />
      {(intro || top.length > 0 || city) && (
        <section className="container-x mt-4 space-y-8" aria-label="Další informace">
          {intro && <div className="card max-w-3xl p-6"><Markdown source={intro} /></div>}
          {top.length > 0 && (
            <div>
              <h2 className="mb-3 text-lg font-bold">{city ? 'Další města' : `${(sub ?? cat)?.name ?? 'Inzeráty'} podle měst`}</h2>
              <div className="flex flex-wrap gap-2">
                {top.map((c) => <Link key={c} href={`${base}/${citySlug(c)}`} className="chip">{c}<span className="text-muted">{counts.get(c)}</span></Link>)}
              </div>
            </div>
          )}
          {city && cat && <p className="text-sm text-muted"><Link href={`/kategorie/${cat.slug}${sub ? `/${sub.slug}` : ''}`} className="font-medium text-brand-ink hover:underline">{(sub ?? cat).name} z celé ČR</Link> · <Link href={`/lokalita/${citySlug(city.name)}`} className="font-medium text-brand-ink hover:underline">Všechny inzeráty {city.name}</Link></p>}
        </section>
      )}
    </>
  );
}
