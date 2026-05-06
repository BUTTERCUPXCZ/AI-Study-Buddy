import { UserRole } from '@prisma/client';

/**
 * Permission keys for the admin RBAC. Code is the source of truth —
 * no permissions table in the DB. Roles are durable; permissions are
 * a code concern that ships with each release.
 *
 * Naming: `<resource>:<action>`. Add to this object only — never
 * remove a permission once shipped, even if all roles drop it,
 * because audit logs may reference the string.
 */
export const Permissions = {
  USER_READ: 'user:read',
  USER_BAN: 'user:ban',
  USER_PROMOTE: 'user:promote',
  PAYMENT_READ: 'payment:read',
  PAYMENT_REFUND: 'payment:refund',
  AUDIT_READ: 'audit:read',
  METRICS_READ: 'metrics:read',
  SALES_READ: 'sales:read',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];

/**
 * Role → permissions mapping. SUPER_ADMIN inherits everything by
 * intention (computed at module load).
 */
const supportPermissions: Permission[] = [
  Permissions.USER_READ,
  Permissions.AUDIT_READ,
  Permissions.METRICS_READ,
  Permissions.SALES_READ,
  Permissions.PAYMENT_READ,
];

const adminPermissions: Permission[] = [
  ...supportPermissions,
  Permissions.USER_BAN,
  Permissions.PAYMENT_REFUND,
];

const allPermissions: Permission[] = Object.values(Permissions);

export const RolePermissions: Record<UserRole, readonly Permission[]> = {
  USER: [],
  SUPPORT: supportPermissions,
  ADMIN: adminPermissions,
  SUPER_ADMIN: allPermissions, // explicit list ensures USER_PROMOTE is included
};

/**
 * Returns true when the role has every permission in `required`.
 */
export function roleHasPermissions(
  role: UserRole | null | undefined,
  required: readonly Permission[],
): boolean {
  if (!role) return false;
  const granted = RolePermissions[role];
  if (!granted || granted.length === 0) return required.length === 0;
  for (const p of required) {
    if (!granted.includes(p)) return false;
  }
  return true;
}
