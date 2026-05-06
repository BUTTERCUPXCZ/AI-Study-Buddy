import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';

/**
 * S11 — CSRF defence-in-depth via the double-submit cookie pattern.
 *
 * The browser sends the auth cookie automatically on cross-origin
 * requests when SameSite=None (the prod setting). CORS already restricts
 * which origins can read the response, but it does NOT stop the request
 * from being made. With SameSite=Lax, modern browsers block cross-site
 * POSTs, but a same-site sub-domain takeover (e.g. attacker controls
 * `*.frontend.com`) can still issue authenticated state changes.
 *
 * Defence: issue a non-httpOnly `csrf_token` cookie that JS on the
 * legitimate frontend can read. Frontend echoes it as `X-CSRF-Token`
 * on every state-changing request. This middleware compares header to
 * cookie via timing-safe equality. An attacker on a different origin
 * cannot read the cookie (cross-origin script can't read it), so the
 * header value is unobtainable.
 *
 * The token is rotated on issuance only — keeping it stable for the
 * session avoids breaking long-lived SPAs that pre-fetch many resources.
 *
 * Exempt paths:
 *  - GET / HEAD / OPTIONS — safe methods, no state change
 *  - /webhooks/stripe — server-to-server, not browser-driven
 *  - /auth/login + /auth/register + /auth/oauth — bootstrap before token exists
 *  - /auth/csrf — endpoint that issues the token
 */

const TOKEN_COOKIE = 'csrf_token';
const TOKEN_HEADER = 'x-csrf-token';
const TOKEN_BYTES = 32;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const EXEMPT_PATHS = [
  '/webhooks/stripe',
  '/auth/login',
  '/auth/register',
  '/auth/oauth',
  '/auth/oauth-callback',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/resend-verification',
  '/auth/verify-email',
  '/auth/csrf',
];

export function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Issue (or refresh) the CSRF cookie. Call this from controllers that
 * authenticate the user — typically `/auth/me` and the login response.
 * The cookie is non-httpOnly because legitimate JS on the same origin
 * needs to read it; CORS prevents cross-origin reads.
 */
export function issueCsrfCookie(res: Response): string {
  const token = generateCsrfToken();
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: false,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    // 24h — survives a workday but rotates regularly.
    maxAge: 24 * 60 * 60 * 1000,
  });
  return token;
}

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  // res is unused but the NestMiddleware interface requires the full triple.
  use(req: Request, _res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) return next();
    if (
      EXEMPT_PATHS.some((p) => req.path === p || req.path.startsWith(p + '/'))
    ) {
      return next();
    }

    const cookie = (req as Request & { cookies?: Record<string, string> })
      .cookies?.[TOKEN_COOKIE];
    const headerVal = req.headers[TOKEN_HEADER];
    const header = Array.isArray(headerVal) ? headerVal[0] : headerVal;

    if (!cookie || !header) {
      throw new ForbiddenException('CSRF token missing');
    }

    // Timing-safe compare. Lengths must match first or timingSafeEqual
    // throws — treat that as a mismatch.
    const a = Buffer.from(cookie);
    const b = Buffer.from(header);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('CSRF token mismatch');
    }

    next();
  }
}
