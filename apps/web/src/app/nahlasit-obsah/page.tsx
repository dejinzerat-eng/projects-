import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { NoticeForm } from '@/components/notice-form';
import { api, getMe } from '@/lib/api';
import { social } from '@/lib/seo';

const title = 'Nahlásit nezákonný obsah';
const description = 'Oznamte nám nezákonný obsah na DEJINZERAT.cz podle nařízení o digitálních službách (DSA). Formulář funguje i bez registrace.';
export const metadata: Metadata = { title, description, alternates: { canonical: '/nahlasit-obsah' }, ...social({ title, description, path: '/nahlasit-obsah' }) };

type Cat = { value: string; label: string; anonymous: boolean };

export default async function Page({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  const [categories, providers, me] = await Promise.all([
    api<Cat[]>('/notices/categories', { revalidate: 3600, auth: false }).catch(() => [] as Cat[]),
    api<{ captchaSiteKey: string | null }>('/auth/providers', { revalidate: 300, auth: false }).catch(() => ({ captchaSiteKey: null })),
    getMe(),
  ]);
  return (
    <div className="container-x max-w-2xl py-8 sm:py-12">
      <ShieldAlert className="size-9 text-danger" strokeWidth={1.75} />
      <h1 className="h-display mt-3 text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-3 text-ink-2">Narazili jste na inzerát, profil nebo zprávu, které jsou podle vás v rozporu se zákonem – třeba podvod, padělky, zbraně nebo drogy? Dejte nám vědět. Účet k tomu nepotřebujete.</p>
      <p className="mt-2 text-sm text-muted">Pro běžné porušení pravidel (špatná kategorie, duplicitní inzerát) stačí tlačítko „Nahlásit“ u inzerátu. <Link href="/stranka/nahlasovani-obsahu" className="font-medium text-brand-ink hover:underline">Jak oznámení vyřizujeme</Link></p>
      <div className="mt-8">
        {categories.length
          ? <NoticeForm categories={categories} url={url?.startsWith('http') ? url : ''} name={me?.name ?? ''} email={me?.email ?? ''} captchaSiteKey={providers.captchaSiteKey} />
          : <p className="card p-6 text-muted">Formulář je dočasně nedostupný. Napište nám prosím e-mailem – kontakt najdete na stránce <Link href="/stranka/kontakt" className="underline">Kontakt</Link>.</p>}
      </div>
    </div>
  );
}
