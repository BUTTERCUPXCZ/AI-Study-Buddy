import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

interface AuthedRequest extends Request {
  user?: { id: string; email?: string; supabaseId?: string };
}

/**
 * Param decorator that pulls the authenticated user (or one of its fields)
 * off the request. Requires `AuthGuard` to have run first — that's where
 * `request.user` is populated. Calling this on a route without the guard
 * raises 401 rather than silently returning undefined, which historically
 * led to IDOR vulnerabilities (treating "no user" as "user 0" or similar).
 *
 * Usage:
 *   @CurrentUser('id') userId: string
 *   @CurrentUser() user: { id; email; ... }
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException(
        '@CurrentUser used on a route without AuthGuard',
      );
    }
    return field ? user[field as keyof typeof user] : user;
  },
);
