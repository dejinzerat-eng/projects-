import { can, isAdminRole, Role } from '@dej/shared';

/**
 * Pravidla pro zásahy do účtů (čisté funkce, testy ve staff-policy.spec.ts).
 * Vrací chybovou hlášku, nebo null, když je akce povolená.
 * „Poslední hlavní administrátor“ = jediný aktivní (nezablokovaný) účet s rolí SUPERADMIN.
 */
export interface PolicyActor { id: string; role: Role | string }
export interface PolicyTarget { id: string; role: Role | string; status: string }
export type TargetStatus = 'ACTIVE' | 'BLOCKED' | 'RESTRICTED';

export function checkRoleChange(actor: PolicyActor, target: PolicyTarget, newRole: Role, activeSuperadmins: number): string | null {
  if (actor.id === target.id) return 'Svou vlastní roli nemůžete měnit.';
  if (!can(actor.role, 'users.roles')) return 'Nemáte oprávnění měnit role.';
  if ((isAdminRole(target.role) || isAdminRole(newRole)) && !can(actor.role, 'admins.manage')) return 'Role administrátorů může měnit jen hlavní administrátor.';
  if (target.role === 'SUPERADMIN' && target.status === 'ACTIVE' && newRole !== 'SUPERADMIN' && activeSuperadmins <= 1) return 'Posledního hlavního administrátora nelze odebrat.';
  return null;
}

export function checkStatusChange(actor: PolicyActor, target: PolicyTarget, next: TargetStatus, activeSuperadmins: number): string | null {
  if (actor.id === target.id) return 'Nemůžete zablokovat ani omezit sami sebe.';
  const perm = next === 'BLOCKED' ? 'users.block' : next === 'RESTRICTED' || target.status === 'RESTRICTED' ? 'users.restrict' : 'users.unblock';
  if (!can(actor.role, perm)) return 'Nemáte oprávnění k této akci.';
  if (target.role !== 'USER') {
    if (!can(actor.role, 'users.manage')) return 'Účty členů týmu může blokovat jen administrátor.';
    if (isAdminRole(target.role) && !can(actor.role, 'admins.manage')) return 'Administrátory může blokovat jen hlavní administrátor.';
    if (target.role === 'SUPERADMIN' && target.status === 'ACTIVE' && next !== 'ACTIVE' && activeSuperadmins <= 1) return 'Posledního hlavního administrátora nelze zablokovat.';
  }
  return null;
}
