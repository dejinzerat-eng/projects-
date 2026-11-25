import 'server-only';
import Link from 'next/link';
import { can, Permission, permissionsOf } from '@dej/shared';
import { getMe } from '@/lib/api';

/** Kontrola oprávnění na serveru pro stránku administrace. Vrací uživatele a jeho oprávnění. */
export async function access(perm: Permission) {
  const me = await getMe();
  return { me, ok: !!me && can(me.role, perm), perms: permissionsOf(me?.role) };
}

export function NoAccess() {
  return (
    <div className="card p-8 text-center">
      <h1 className="text-xl font-bold">Sem nemáte přístup</h1>
      <p className="mt-2 text-muted">Vaše role tuto část administrace nezahrnuje. Pokud ji potřebujete, požádejte hlavního administrátora.</p>
      <Link href="/admin" className="btn btn-outline btn-sm mt-4">Zpět na přehled</Link>
    </div>
  );
}
