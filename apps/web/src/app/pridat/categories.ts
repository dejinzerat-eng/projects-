import 'server-only';
import type { WizardCategory } from '@/components/listing-wizard';
import { api } from '@/lib/api';

/**
 * Kategorie pro průvodce přímo z databáze (spravuje je administrace, neaktivní API nevrací).
 * Do prohlížeče posíláme jen to, co průvodce potřebuje – bez SEO textů a počtů.
 */
export async function wizardCategories(): Promise<WizardCategory[]> {
  const all = await api<WizardCategory[]>('/categories', { auth: false });
  return all.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon, children: c.children.map((s) => ({ slug: s.slug, name: s.name, fields: s.fields ?? [] })) }));
}
