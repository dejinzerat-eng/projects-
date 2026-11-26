import { CategoriesEditor } from '@/components/admin/tables';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';
export default async function Page() {
  if (!(await access('categories.manage')).ok) return <NoAccess />;
  return <div><h1 className="h-display mb-2 text-3xl font-bold">Kategorie a SEO</h1><p className="mb-5 text-muted">Přidávejte, přesouvejte a mažte kategorie. Prázdnou kategorii lze smazat hned, jinak nejdřív vyberete, kam přesunout její inzeráty.</p><CategoriesEditor rows={await api('/admin/categories')} /></div>;
}
