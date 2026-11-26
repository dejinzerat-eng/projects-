import Link from 'next/link';
import { CATEGORIES } from '@dej/shared';
import { api } from '@/lib/api';
import { getOperator, isPlaceholder } from '@/lib/operator';
import { citySlug } from '@/lib/seo';
import type { Category } from '@/lib/types';
import { LogoMark } from './logo';
import { ThemeToggle } from './theme-toggle';

const CITIES = ['Praha', 'Brno', 'Ostrava', 'Plzeň', 'Liberec', 'Olomouc', 'České Budějovice', 'Hradec Králové'];
const LEGAL = [
  ['/stranka/podminky', 'Podmínky používání'],
  ['/stranka/ochrana-udaju', 'Ochrana osobních údajů'],
  ['/stranka/cookies', 'Cookies'],
  ['/stranka/pravidla-inzerovani', 'Pravidla inzerování'],
  ['/stranka/spotrebitele', 'Informace pro spotřebitele'],
  ['/stranka/podminky-placenych-sluzeb', 'Podmínky placených služeb'],
  ['/stranka/nahlasovani-obsahu', 'Nahlašování obsahu (DSA)'],
  ['/nahlasit-obsah', 'Nahlásit nezákonný obsah'],
];

function Col({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <ul className="space-y-2 text-muted">{links.map(([href, label]) => <li key={href}><Link className="hover:text-ink" href={href}>{label}</Link></li>)}</ul>
    </div>
  );
}

export async function Footer() {
  const [cats, op] = await Promise.all([
    api<Category[]>('/categories', { revalidate: 300, auth: false }).catch(() => CATEGORIES.map((c) => ({ slug: c.slug, name: c.name }))),
    getOperator(),
  ]);
  return (
    <footer className="mt-20 border-t border-line bg-surface pb-24 md:pb-0">
      <div className="container-x grid gap-10 py-12 lg:grid-cols-[1fr_2.4fr]">
        <div>
          <div className="flex items-center gap-2"><LogoMark className="size-7" /><span className="h-display text-lg font-bold"><span className="text-brand">dej</span>inzerat.cz</span></div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">Jednoduchá a bezpečná inzerce pro celou Českou republiku.</p>
          <address className="mt-5 space-y-1 text-sm not-italic text-muted">
            <div className="font-semibold text-ink-2">Provozovatel</div>
            <div>{op.name}</div>
            <div>IČO {op.ico}</div>
            <div>{op.address}</div>
            {!isPlaceholder(op.registry) && <div>{op.registry}</div>}
            <div className="pt-1"><a className="font-medium text-brand-ink hover:underline" href={`mailto:${op.email}`}>{op.email}</a>{!isPlaceholder(op.phone) && <> · <a className="hover:text-ink" href={`tel:${op.phone.replace(/\s/g, '')}`}>{op.phone}</a></>}</div>
          </address>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4">
          <Col title="Kategorie" links={cats.slice(0, 8).map((c) => [`/kategorie/${c.slug}`, c.name])} />
          <Col title="Lokality" links={CITIES.map((c) => [`/lokalita/${citySlug(c)}`, c])} />
          <Col title="Portál" links={[['/pridat', 'Přidat inzerát'], ['/cenik', 'Topování a ceník'], ['/stranka/bezpecny-nakup', 'Bezpečný nákup'], ['/stranka/napoveda', 'Nápověda'], ['/stranka/kontakt', 'Kontakt']]} />
          <Col title="Právní" links={LEGAL as [string, string][]} />
        </div>
      </div>
      <div className="border-t border-line"><div className="container-x flex items-center justify-between gap-4 py-5 text-xs text-muted"><span>© {new Date().getFullYear()} Dejinzerat.cz · {op.name}</span><ThemeToggle /></div></div>
    </footer>
  );
}
