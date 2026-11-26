import { CategoryIntros, HomeSeo, PageMeta, Redirects } from '@/components/admin/seo';
import { HOME_DESCRIPTION, HOME_TITLE } from '@/lib/seo';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';

export default async function Page() {
  if (!(await access('pages.edit')).ok) return <NoAccess />;
  const [home, redirects, cats, pages] = await Promise.all([api<{ homeTitle: string; homeDescription: string }>('/admin/seo/home'), api('/admin/seo/redirects'), api('/admin/seo/categories'), api('/admin/pages')]);
  return (
    <div className="space-y-10">
      <div>
        <h1 className="h-display text-3xl font-bold">SEO</h1>
        <p className="mt-1 text-sm text-muted">Titulky a popisy kategorií upravíte v sekci Kategorie a SEO, texty stránek v sekci Texty a stránky. Sitemapa: <a href="/sitemap.xml" target="_blank" className="underline">/sitemap.xml</a>.</p>
      </div>
      <section><h2 className="mb-1 text-xl font-bold">Úvodní stránka</h2><p className="mb-3 text-sm text-muted">Titulek a popis pro vyhledávače a sdílení. Prázdné pole = výchozí text. Změna se projeví do 5 minut.</p><HomeSeo initial={home} defaults={{ title: HOME_TITLE, description: HOME_DESCRIPTION }} /></section>
      <section><h2 className="mb-1 text-xl font-bold">Přesměrování</h2><p className="mb-3 text-sm text-muted">Při změně adresy kategorie se trvalé přesměrování vytvoří samo.</p><Redirects rows={redirects as Parameters<typeof Redirects>[0]['rows']} /></section>
      <section><h2 className="mb-3 text-xl font-bold">Úvodní texty kategorií</h2><CategoryIntros rows={cats as Parameters<typeof CategoryIntros>[0]['rows']} /></section>
      <section><h2 className="mb-1 text-xl font-bold">Informační a právní stránky</h2><p className="mb-3 text-sm text-muted">Datum účinnosti a kontroly právníkem se zobrazí v záhlaví stránky.</p><PageMeta rows={pages as Parameters<typeof PageMeta>[0]['rows']} /></section>
    </div>
  );
}
