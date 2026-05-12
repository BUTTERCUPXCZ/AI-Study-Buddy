# Deployment

This doc captures the production checks and env vars that must be set for
each release. Most of them are silent failure modes — wrong, and the app
still boots, but some flow breaks for real users.

## Backend (NestJS — Render or any Node host)

Required environment variables:

| Var | Why |
|---|---|
| `DATABASE_URL` | Prisma connection URL (pooled) |
| `DIRECT_URL` | Prisma direct-connection URL for migrations |
| `SUPABASE_URL` | Supabase project URL; used by the backend's service-role client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role JWT; signs admin Supabase calls |
| `FRONTEND_URL` | Used in `emailRedirectTo` for Supabase signup confirmation links |
| `NODE_ENV` | Must be `production`; controls cookie `secure` and `sameSite` flags in `auth.service.ts:setAuthCookie` |
| `REDIS_URL` | Brute-force lockout store (S1). Required for login rate limiting to span workers |

Missing any of `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` → `supabase.auth.signUp` rejects at boot or first call, and the user sees a 500 on register with no idea what's wrong.

Missing `NODE_ENV=production` → the auth cookie is set with `secure: false`
and `sameSite: 'lax'`. Cross-origin SPA + API setups will then drop the
cookie on every request and users will appear logged out immediately
after login.

## Frontend (Vite — Vercel)

| Var | Why |
|---|---|
| `VITE_API_BASE_URL` | Points the axios client at the backend |
| `VITE_SUPABASE_URL` | Used by the browser Supabase client for OAuth + email-verify session retrieval |
| `VITE_SUPABASE_ANON_KEY` | Public anon key for the browser client |

## Supabase dashboard

These are project-level settings, **not** env vars. They have to be
toggled in the Supabase web console for the production project.

1. **Auth → Providers → Email → "Confirm email" must be ON.**
   When this is OFF, `supabase.auth.signUp` returns a session immediately,
   the user is auto-confirmed, and the email-verification step is bypassed.
   The backend logs a warning (`register_supabase_returned_session`) if it
   ever sees a session attached to a signup response — search logs for that
   string after any deploy to confirm the toggle is still ON.

2. **Auth → URL Configuration:**
   - **Site URL** = production frontend origin (e.g. `https://app.example.com`).
   - **Redirect URLs** allowlist must include `<frontend>/supabaseCallback`
     and `<frontend>/resetpassword`.

3. **Auth → Email Templates → "Confirm signup":**
   The action URL must point at the Supabase-issued callback that ends up
   redirecting to `<frontend>/supabaseCallback`. Default template is fine
   but verify the `Site URL` substitution renders the real prod host.

## Post-deploy smoke test (5 minutes, do it every release)

1. Open `<frontend>/register` in an incognito window.
2. Register a throwaway email (`yourname+smoke-<date>@example.com`).
3. **Assert the browser URL changes to `<frontend>/emailVerify?email=...`** —
   not `/login`. This is the regression class we hit in May 2026 and the
   Playwright spec at `frontend/e2e/register.spec.ts` guards against it.
4. Open the inbox: confirmation mail from Supabase should arrive within
   ~30 s.
5. Click the link → land on `/supabaseCallback` → forwarded to `/login`.
6. Log in with the new credentials. You should reach `/notes`.

If any step fails:

- **Step 3 fails (`/login` instead of `/emailVerify`):**
  Two distinct failure modes share this symptom:
  1. **axios 401 interceptor over-redirect** — `frontend/src/lib/api.ts`
     used to call `window.location.replace('/login')` on any 401, including
     the AuthContext bootstrap `/auth/me` probe that *always* 401s on a
     fresh browser. That kicked users off /register before/after they
     could register. Fixed May 2026 by guarding the redirect with
     `isAuthProbe(url)` + `isOnPublicRoute()` allowlists. If the bug
     re-appears, verify those guards weren't removed.
  2. **Supabase auto-confirms signup** — check backend logs for
     `register_supabase_returned_session`. Means Supabase project's
     "Confirm email" toggle is OFF; flip it back ON.
- **Step 4 fails (no mail):**
  Check Supabase dashboard → Auth → Logs. Common cause: `Site URL` /
  redirect allowlist mismatch.
- **Step 6 fails (still "email not verified"):**
  Backend never received the `/auth/verify-email/callback` POST. Check
  CORS, network tab for that request, and the `email_verified` /
  `email_verify_failed` audit log entries.

## CI

The Playwright e2e spec runs against the dev server with the
`/auth/register` route mocked, so CI does not need Supabase credentials.
Locally, run once:

```bash
cd frontend
npm run test:e2e:install   # downloads the chromium binary
npm run test:e2e
```
