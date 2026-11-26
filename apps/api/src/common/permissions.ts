import { applyDecorators, CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { can, Permission } from '@dej/shared';
import type { AuthUser } from './auth.guard';
import { Auth } from './auth.guard';

const PERMS_KEY = 'permissions';

/** Kontrola oprávnění podle mapy ROLE_PERMISSIONS (packages/shared/src/permissions.ts). Akce vyžaduje všechna uvedená oprávnění. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const perms = this.reflector.getAllAndOverride<Permission[]>(PERMS_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!perms?.length) return true;
    const user = ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user) throw new UnauthorizedException('Pro tuto akci se musíte přihlásit.');
    if (!perms.every((p) => can(user.role, p))) throw new ForbiddenException('Nemáte oprávnění.');
    return true;
  }
}

/** `@Can('reports.handle')` – přihlášení povinné + oprávnění z mapy rolí. */
export const Can = (...perms: Permission[]) => applyDecorators(Auth('required'), SetMetadata(PERMS_KEY, perms), UseGuards(PermissionGuard));
