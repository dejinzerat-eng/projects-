import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppealForm } from '@/components/appeal-form';
import { api, getMe } from '@/lib/api';

export const metadata = { title: 'Námitka proti rozhodnutí moderace', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ inzerat?: string }> }) {
  const { inzerat } = await searchParams;
  const me = await getMe();
  if (!me) redirect(`/prihlaseni?zpet=${encodeURIComponent(`/namitka${inzerat ? `?inzerat=${inzerat}` : ''}`)}`);
  const items = await api<Parameters<typeof AppealForm>[0]['items']>('/appeals/eligible').catch(() => []);
  return (
    <div className="container-x max-w-2xl py-8 sm:py-12">
      <h1 className="h-display text-3xl font-bold sm:text-4xl">Námitka proti rozhodnutí</h1>
      <p className="mt-3 text-ink-2">Stáhli jsme váš inzerát a myslíte si, že neprávem? Podejte námitku do 6 měsíců od rozhodnutí. Je zdarma a posoudí ji člověk, který o inzerátu nerozhodoval.</p>
      <p className="mt-2 text-sm text-muted">Více v <Link href="/stranka/podminky" className="underline">podmínkách používání</Link> a na stránce <Link href="/stranka/nahlasovani-obsahu" className="underline">Nahlašování nezákonného obsahu</Link>.</p>
      <div className="mt-8"><AppealForm items={items} selected={inzerat} /></div>
    </div>
  );
}
