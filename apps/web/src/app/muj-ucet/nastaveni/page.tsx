import { Settings, type SessionItem } from '@/components/settings';
import { api, getMe } from '@/lib/api';
export const metadata = { title: 'Nastavení účtu', robots: { index: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ vitejte?: string }> }) {
  const [me, blocked, sessions, providers, sp] = await Promise.all([
    getMe(), api<{ id: string; name: string }[]>('/me/blocked'), api<SessionItem[]>('/auth/sessions').catch(() => []),
    api<{ sms: boolean }>('/auth/providers', { auth: false }).catch(() => ({ sms: false })), searchParams,
  ]);
  return <Settings me={me!} blocked={blocked} sessions={sessions} smsEnabled={providers.sms} welcome={sp.vitejte === '1'} />;
}
