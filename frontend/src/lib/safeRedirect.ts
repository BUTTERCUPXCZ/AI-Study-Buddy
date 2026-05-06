/**
 * S12 — open-redirect protection.
 *
 * Anywhere the app reads a `redirect` query param (typically the OAuth
 * callback) it MUST run the value through this helper before passing it
 * to the router. An attacker can otherwise craft
 * `/supabaseCallback?redirect=https://attacker.com` and phish the user
 * immediately after a successful login — the user trusts the URL because
 * they just logged in to our domain.
 *
 * Whitelist beats blacklist: we list known-safe paths and reject anything
 * else (including protocol-relative `//attacker.com` which the browser
 * resolves to a cross-origin URL).
 */

const ALLOWED_PATHS = new Set<string>([
  '/library',
  '/notes',
  '/quizzes',
  '/tutor',
  '/admin',
])

const DEFAULT_FALLBACK = '/library'

export function safeRedirect(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_FALLBACK

  // Reject anything that looks remotely like an absolute URL.
  if (raw.includes('://') || raw.startsWith('//')) return DEFAULT_FALLBACK

  // Must start with `/` so the router treats it as in-app navigation.
  if (!raw.startsWith('/')) return DEFAULT_FALLBACK

  // Strip query / hash before whitelist comparison.
  const path = raw.split('?')[0].split('#')[0]

  // Allow exact whitelisted root paths.
  if (ALLOWED_PATHS.has(path)) return raw

  // Allow nested paths under the whitelisted roots (e.g. /notes/abc).
  for (const root of ALLOWED_PATHS) {
    if (path === root || path.startsWith(root + '/')) {
      return raw
    }
  }

  return DEFAULT_FALLBACK
}
