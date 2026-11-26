import { SettingsForm } from '@/components/admin/settings';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';
export default async function Page() {
  const { ok, perms } = await access('settings.manage');
  if (!ok) return <NoAccess />;
  return <div><h1 className="h-display mb-2 text-3xl font-bold">Systémová nastavení</h1><p className="mb-5 text-muted">Platí okamžitě (do 30 sekund na všech serverech). Bez uložené hodnoty se použije výchozí nastavení serveru.</p><SettingsForm initial={await api('/admin/settings')} canReindex={perms.includes('search.reindex')} /></div>;
}
