import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, roleHasPermissions } from '../rbac';

interface AuthedRequest {
  user?: {
    id: string;
    email?: string;
    role?: UserRole;
  };
}

/**
 * Enforces role + permission requirements declared via `@Roles()` and
 * `@RequirePermissions()` decorators. Runs after `AuthGuard` so it can
 * trust `req.user.id`.
 *
 * If neither decorator is present anywhere on the route (handler or
 * class), the guard is a no-op — admin-only routes are opt-in.
 *
 * Bootstrap promotion: if `ADMIN_EMAILS` env var lists the user's
 * email AND their role is still USER, promote them to ADMIN
 * idempotently. Reserves SUPER_ADMIN for the seed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly db: DatabaseService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    const requiredPerms = this.reflector.getAllAndOverride<
      Permission[] | undefined
    >(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]);

    // No RBAC requirements declared → guard does nothing.
    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPerms || requiredPerms.length === 0)
    ) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    // Pull role + email from DB (AuthGuard doesn't currently attach
    // role; we fetch fresh so promotion can happen here).
    const dbUser = await this.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!dbUser) throw new UnauthorizedException('User not found');

    let effectiveRole: UserRole = dbUser.role;

    // Bootstrap auto-promotion via ADMIN_EMAILS env allowlist.
    const allowlist = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (
      effectiveRole === UserRole.USER &&
      allowlist.includes((dbUser.email ?? '').toLowerCase())
    ) {
      try {
        await this.db.user.update({
          where: { id: userId },
          data: { role: UserRole.ADMIN },
        });
        effectiveRole = UserRole.ADMIN;
        this.logger.log(
          `Auto-promoted ${dbUser.email} to ADMIN via ADMIN_EMAILS`,
        );
      } catch (err) {
        this.logger.warn(
          `ADMIN_EMAILS auto-promotion failed for ${dbUser.email}: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }

    if (req.user) req.user.role = effectiveRole;

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(effectiveRole)) {
        throw new ForbiddenException('Insufficient role');
      }
    }
    if (requiredPerms && requiredPerms.length > 0) {
      if (!roleHasPermissions(effectiveRole, requiredPerms)) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    return true;
  }
}
