import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../rbac';

export const PERMISSIONS_KEY = 'rbac:permissions';

/**
 * Restrict a handler / controller to actors holding ALL listed
 * permissions. Permissions are derived from the actor's role via
 * `RolePermissions` in `rbac.ts`.
 *
 * Usage:
 *   @RequirePermissions(Permissions.USER_BAN)
 *   @Post('users/:id/ban')
 *   async banUser() { ... }
 */
export const RequirePermissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
