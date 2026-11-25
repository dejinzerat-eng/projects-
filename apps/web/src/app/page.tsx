import Link from 'next/link';
import { ArrowRight, BadgeCheck, BellRing, MessagesSquare, Plus } from 'lucide-react';
import { CategoryIcon } from '@/components/icons';
import { ListingGrid } from '@/components/listing-card';
import { SearchBox } from '@/components/search-box';
import { api } from '@/lib/api';
import { plural } from '@/lib/format';
import type { Category, ListingCard } from '@/lib/types';

const POPULAR = ['iPhone 15', 'Byt 2+kk Praha pronájem', 'Kočárek', 'Horské kolo do 15 000 Kč', 'PlayStation 5', 'Škoda Octavia'];

export default async function Home() {
  const [cats, latest] = await Promise.all([
    api<Category[]>('/categories', { revalidate: 60, auth: false }).catch(() => [] as Category[]),
    api<ListingCard[]>('/listings/latest?limit=16', { auth: false }).catch(() => [] as ListingCard[]),
  ]);
  const total = cats.reduce((a, c) => a + c.count, 0);

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-brand-soft blur-3xl opacity-70" />
        <div className="container-x relative py-10 sm:py-16 lg:py-20">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2">
              <span className="size-2 rounded-full bg-trust" />{plural(total, 'aktivní inzerát', 'aktivní inzeráty', 'aktivních inzerátů')} z celé ČR a SR
            </p>
            <h1 className="h-display text-[40px] font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
              Najděte, co hledáte.<br /><span className="text-brand">Prodejte</span>, co nepotřebujete.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">Pište, jak mluvíte. Rozumíme cenám, lokalitám i stavu zboží – a dáme vědět, až se objeví nová nabídka.</p>
          </div>
          <div className="mt-8 max-w-3xl"><SearchBox size="lg" /></div>
          <div className="mt-4 flex max-w-3xl gap-2 overflow-x-auto scrollbar-none pb-1">
            {POPULAR.map((p) => <Link key={p} href={`/hledat?q=${encodeURIComponent(p)}&chytre=1`} className="chip shrink-0">{p}</Link>)}
          </div>
        </div>
      </section>

      <section className="container-x pt-10 sm:pt-14" aria-labelledby="kat">
        <div className="mb-5 flex items-end justify-between">
          <h2 id="kat" className="h-display text-2xl font-bold sm:text-3xl">Kategorie</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
          {cats.map((c) => (
            <Link key={c.slug} href={`/kategorie/${c.slug}`} className="group flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface px-2 py-4 text-center transition hover:border-ink-2 hover:shadow-card sm:items-start sm:px-4 sm:text-left">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand transition group-hover:bg-brand group-hover:text-white">
                <CategoryIcon name={c.icon} className="size-[22px]" />
              </span>
              <span className="text-[13px] font-semibold leading-tight sm:text-[15px]">{c.name}</span>
              <span className="hidden text-xs text-muted sm:block">{plural(c.count, 'inzerát', 'inzeráty', 'inzerátů')}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-x pt-14" aria-labelledby="nove">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 id="nove" className="h-display text-2xl font-bold sm:text-3xl">Čerstvě přidané</h2>
          <Link href="/hledat?razeni=newest" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink hover:underline">Zobrazit vše<ArrowRight className="size-4" /></Link>
        </div>
        {latest.length ? <ListingGrid items={latest} /> : <p className="card p-8 text-center text-muted">Zatím tu nejsou žádné inzeráty. Buďte první!</p>}
      </section>

      <section className="container-x pt-16">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { icon: BadgeCheck, t: 'Ověření prodejci', d: 'Telefon ověřený SMS kódem, hodnocení jen po skutečné komunikaci a průhledné skóre důvěry.' },
            { icon: BellRing, t: 'Hlídací pes', d: 'Uložte si hledání a my vám pošleme upozornění, jakmile se objeví odpovídající nabídka.' },
            { icon: MessagesSquare, t: 'Zprávy bez rizika', d: 'Domluvte se v chatu bez zveřejnění čísla. Podezřelé zprávy automaticky označíme.' },
          ].map((f) => (
            <div key={f.t} className="card p-6">
              <f.icon className="size-7 text-brand" strokeWidth={1.75} />
              <h3 className="mt-4 text-lg font-bold">{f.t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x pt-6">
        <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-10 text-paper sm:px-12 sm:py-14">
          <div aria-hidden className="absolute -right-24 -bottom-24 size-80 rounded-full bg-brand opacity-30 blur-2xl" />
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="h-display text-3xl font-extrabold sm:text-4xl">Prodejte to během pár minut.</h2>
              <p className="mt-2 max-w-lg text-paper/75">Nafoťte, napište pár slov a my doporučíme kategorii i cenu podle podobných nabídek. Inzerát je zdarma.</p>
            </div>
            <Link href="/pridat" className="btn btn-primary btn-lg shrink-0"><Plus className="size-5" strokeWidth={2.5} />Přidat inzerát zdarma</Link>
          </div>
        </div>
      </section>
    </>
  );
}
