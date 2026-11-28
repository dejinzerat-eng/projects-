/**
 * Role a oprávnění administrace – jediná mapa, kterou používá API (PermissionGuard, @Can)
 * i webová administrace (skrývá, co role nesmí).
 */
export const ROLES = ['USER', 'SUPPORT', 'MODERATOR', 'BUSINESS_MANAGER', 'ADMIN', 'SUPERADMIN'] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES = ROLES.filter((r) => r !== 'USER');

export const ROLE_LABEL: Record<Role, string> = {
  USER: 'Uživatel',
  SUPPORT: 'Zákaznická podpora',
  MODERATOR: 'Moderátor',
  BUSINESS_MANAGER: 'Správce obchodních účtů',
  ADMIN: 'Administrátor',
  SUPERADMIN: 'Hlavní administrátor',
};

export const PERMISSIONS = {
  'admin.access': 'Vstup do administrace',
  'stats.read': 'Přehled a statistiky',
  'listings.read': 'Prohlížení inzerátů včetně neveřejných',
  'listings.moderate': 'Schvalování, zamítání a mazání inzerátů',
  'listings.edit': 'Úprava cizích inzerátů (s důvodem)',
  'listings.promote': 'Přidělení topování a zvýraznění',
  'reports.read': 'Prohlížení nahlášení včetně nahlášených zpráv',
  'reports.handle': 'Vyřizování nahlášení',
  'users.read': 'Vyhledání uživatelů',
  'users.block': 'Blokování běžných uživatelů',
  'users.unblock': 'Odblokování uživatelů',
  'users.restrict': 'Omezení účtu a zrušení omezení',
  'users.resendVerification': 'Znovu odeslat ověřovací e-mail',
  'users.manage': 'Blokování členů týmu (kromě administrátorů)',
  'users.roles': 'Přidělování rolí (kromě administrátorských)',
  'admins.manage': 'Správa administrátorů a jejich rolí',
  'businesses.manage': 'Firemní účty a jejich ověření',
  'categories.manage': 'Kategorie a SEO',
  'pages.edit': 'Texty a informační stránky',
  'prices.edit': 'Ceník prémiových služeb',
  'banners.manage': 'Reklamní bannery na úvodní stránce',
  'settings.manage': 'Systémová nastavení',
  'audit.read': 'Auditní log',
  'search.reindex': 'Přeindexování vyhledávání',
} as const;
export type Permission = keyof typeof PERMISSIONS;
const ALL = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: [],
  SUPPORT: ['admin.access', 'stats.read', 'listings.read', 'reports.read', 'users.read', 'users.unblock', 'users.resendVerification'],
  MODERATOR: ['admin.access', 'stats.read', 'listings.read', 'listings.moderate', 'listings.edit', 'reports.read', 'reports.handle', 'users.read', 'users.block', 'users.unblock', 'users.restrict'],
  BUSINESS_MANAGER: ['admin.access', 'stats.read', 'listings.read', 'listings.promote', 'users.read', 'businesses.manage', 'prices.edit', 'banners.manage'],
  ADMIN: ALL.filter((p) => p !== 'admins.manage' && p !== 'settings.manage'),
  SUPERADMIN: ALL,
};

export function can(role: string | null | undefined, perm: Permission): boolean {
  return !!role && (ROLE_PERMISSIONS[role as Role] ?? []).includes(perm);
}
export const permissionsOf = (role: string | null | undefined): Permission[] => [...(ROLE_PERMISSIONS[role as Role] ?? [])];
export const isStaff = (role: string | null | undefined) => !!role && role !== 'USER' && role in ROLE_PERMISSIONS;
/** Administrátorské role, které smí měnit jen hlavní administrátor. */
export const isAdminRole = (role: string | null | undefined) => role === 'ADMIN' || role === 'SUPERADMIN';
