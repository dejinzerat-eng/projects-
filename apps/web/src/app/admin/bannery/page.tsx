import { BannersEditor, type AdminBanner } from '@/components/admin/banners';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';

export default async function Page() {
  if (!(await access('banners.manage')).ok) return <NoAccess />;
  return (
    <div>
      <h1 className="h-display mb-2 text-3xl font-bold">Reklamní bannery</h1>
      <p className="mb-5 max-w-3xl text-muted">
        Na úvodní stránce se zobrazí první 3 aktivní bannery vedle sebe (na mobilu pod sebou). Pořadí změníte šipkami.
        Doporučený rozměr obrázku je <strong className="text-ink-2">1200 × 600 px</strong> (poměr 2 : 1), formát JPG, PNG, WebP nebo GIF do 4 MB.
        Bez aktivního banneru se řada vůbec nezobrazí.
      </p>
      <BannersEditor rows={await api<AdminBanner[]>('/admin/banners')} />
    </div>
  );
}
