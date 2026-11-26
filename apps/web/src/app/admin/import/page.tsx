import { LegacyImport, LegacyInvites, type InviteStatus } from '@/components/admin/legacy-import';
import { api } from '@/lib/api';
import { access, NoAccess } from '../_access';

export default async function Page() {
  if (!(await access('settings.manage')).ok) return <NoAccess />;
  const invites = await api<InviteStatus>('/admin/legacy/invites');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-3xl font-bold">Import ze starého webu</h1>
        <p className="mt-1 text-muted">Přenese inzeráty, prodejce a fotky z www.dejinzerat.cz. Poslední import spusťte těsně před přepnutím domény, dokud starý web ještě běží.</p>
      </div>
      <LegacyImport />
      <LegacyInvites initial={invites} />
    </div>
  );
}
