import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'rbac:roles';

/**
 * Restrict a handler / controller to one or more roles.
 *
 * Usage:
 *   @Roles('ADMIN', 'SUPER_ADMIN')
 *   @Get('users')
 *   async listUsers() { ... }
 *
 * The `RolesGuard` reads this metadata. Both class-level and
 * method-level decorators stack; the method-level wins on conflict.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
