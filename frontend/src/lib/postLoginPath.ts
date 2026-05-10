import { safeRedirect } from './safeRedirect'

/**
 * Decide where to send a freshly-authenticated user.
 *
 * - If a `redirect` query param survived the login round-trip and is
 *   whitelisted, honour it (covers deep-links and OAuth `?redirect=…`).
 * - Otherwise, staff (SUPPORT / ADMIN / SUPER_ADMIN) land on `/admin`,
 *   regular users on `/notes`. Without this, an admin who signs in from
 *   the homepage gets dumped on the user-facing notes list and has to
 *   click into the sidebar to reach the dashboard.
 */
const STAFF_ROLES = new Set(['SUPPORT', 'ADMIN', 'SUPER_ADMIN'])

export function postLoginPath(
  user: { role?: string | null } | null | undefined,
  rawRedirect?: string | null,
): string {
  if (rawRedirect) {
    const safe = safeRedirect(rawRedirect)
    // safeRedirect returns the default fallback ('/library') when the
    // input is missing or unsafe — only honour it if it actually
    // matched the supplied value.
    if (safe === rawRedirect) return safe
  }

  if (user?.role && STAFF_ROLES.has(user.role)) return '/admin'
  return '/notes'
}
