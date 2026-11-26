'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Building2, FileText, Flag, Globe, History, Import, LayoutList, Settings, ShieldAlert, Tags, Users, Wallet } from 'lucide-react';
import type { Permission } from '@dej/shared';

const ITEMS: { href: string; label: string; icon: typeof BarChart3; perm: Permission }[] = [
  { href: '/admin', label: 'Přehled', icon: BarChart3, perm: 'stats.read' },
  { href: '/admin/inzeraty', label: 'Inzeráty', icon: LayoutList, perm: 'listings.read' },
  { href: '/admin/nahlaseni', label: 'Nahlášení', icon: Flag, perm: 'reports.read' },
  { href: '/admin/nezakonny-obsah', label: 'Nezákonný obsah', icon: ShieldAlert, perm: 'reports.handle' },
  { href: '/admin/uzivatele', label: 'Uživatelé', icon: Users, perm: 'users.read' },
  { href: '/admin/firmy', label: 'Firemní účty', icon: Building2, perm: 'businesses.manage' },
  { href: '/admin/kategorie', label: 'Kategorie a SEO', icon: Tags, perm: 'categories.manage' },
  { href: '/admin/cenik', label: 'Ceník služeb', icon: Wallet, perm: 'prices.edit' },
  { href: '/admin/stranky', label: 'Texty a stránky', icon: FileText, perm: 'pages.edit' },
  { href: '/admin/seo', label: 'SEO', icon: Globe, perm: 'pages.edit' },
  { href: '/admin/nastaveni', label: 'Nastavení', icon: Settings, perm: 'settings.manage' },
  { href: '/admin/import', label: 'Import ze starého webu', icon: Import, perm: 'settings.manage' },
  { href: '/admin/audit', label: 'Auditní log', icon: History, perm: 'audit.read' },
];

/** Navigace administrace – zobrazí jen sekce, na které má role oprávnění. */
export function AdminNav({ perms, roleLabel }: { perms: Permission[]; roleLabel: string }) {
  const path = usePathname()!;
  const items = ITEMS.filter((i) => perms.includes(i.perm));
  return (
    <nav aria-label="Administrace" className="-mx-4 overflow-x-auto scrollbar-none px-4 lg:mx-0 lg:px-0">
      <div className="mb-3 hidden lg:block"><div className="text-xs font-bold uppercase tracking-wider text-muted">Administrace</div><div className="mt-0.5 text-sm text-muted">{roleLabel}</div></div>
      <ul className="flex gap-1.5 lg:flex-col">
        {items.map((i) => {
          const on = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
          return <li key={i.href}><Link href={i.href} aria-current={on ? 'page' : undefined} className={`flex items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-[15px] font-medium ${on ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-surface-2'}`}><i.icon className="size-[18px]" />{i.label}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
