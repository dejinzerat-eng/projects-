import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';
import { api } from '@/lib/api';

export const metadata = { title: 'Ověření e-mailu', robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; zmena?: string }> }) {
  const { token, zmena } = await searchParams;
  const change = zmena === '1';
  const path = change ? '/auth/email/confirm' : '/auth/verify-email';
  const res = await api(`${path}?token=${encodeURIComponent(token ?? '')}`, { auth: false }).then(() => null).catch((e: Error) => e.message || 'error');
  const ok = res === null;
  const failText = change && res && !/neplatný|vypršel/i.test(res) ? res : 'Odkaz je neplatný nebo vypršel. Nový si můžete poslat v nastavení účtu.';
  return (
    <AuthShell title={ok ? (change ? 'E-mail změněn' : 'E-mail ověřen') : 'Odkaz nefunguje'}>
      <div className="flex flex-col items-center gap-4 text-center">
        {ok ? <CheckCircle2 className="size-12 text-trust" /> : <XCircle className="size-12 text-danger" />}
        <p className="text-ink-2">{ok ? (change ? 'Hotovo, nový e-mail je u vašeho účtu nastavený a ověřený.' : 'Děkujeme, váš e-mail je ověřený.') : failText}</p>
        <Link href={ok && !change ? '/' : '/muj-ucet/nastaveni'} className="btn btn-primary">{ok && !change ? 'Pokračovat' : 'Nastavení účtu'}</Link>
      </div>
    </AuthShell>
  );
}
