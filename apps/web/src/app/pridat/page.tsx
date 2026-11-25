import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText } from 'lucide-react';
import { ListingWizard, type WizardCategory } from '@/components/listing-wizard';
import { ago } from '@/lib/format';
import { api, getMe } from '@/lib/api';

export const metadata = { title: 'Přidat inzerát', robots: { index: false } };

interface Draft { id: string; title: string; createdAt: number }

export default async function Page() {
  const me = await getMe();
  if (!me) redirect('/prihlaseni?zpet=/pridat');
  // Kategorie z databáze (spravuje je administrace) – vždy čerstvé, aby se změna projevila hned
  const [categories, drafts] = await Promise.all([
    api<WizardCategory[]>('/categories', { auth: false }),
    api<Draft[]>('/me/listings?status=DRAFT').catch(() => [] as Draft[]),
  ]);
  return (
    <div className="container-x py-8">
      {drafts.length > 0 && (
        <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FileText className="size-4 text-brand" />Rozpracované koncepty</div>
          <ul className="divide-y divide-line">
            {drafts.slice(0, 3).map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{k.title} <span className="text-muted">· {ago(k.createdAt)}</span></span>
                <Link href={`/inzerat/${k.id}/upravit`} className="btn btn-outline btn-sm shrink-0">Pokračovat</Link>
              </li>
            ))}
          </ul>
          {drafts.length > 3 && <Link href="/muj-ucet/inzeraty" className="mt-1 inline-block text-sm font-semibold text-brand-ink hover:underline">Všechny koncepty ({drafts.length})</Link>}
        </div>
      )}
      <ListingWizard defaultCity={me.city} categories={categories} />
    </div>
  );
}
