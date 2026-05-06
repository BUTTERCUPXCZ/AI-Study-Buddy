# Security — AI-Study-Buddy

This file is the single source of truth for the application's prevention controls. Every control below is wired to a threat, an implementation file, and a verification command. Operators referencing this file should be able to confirm any control is live without reading code.

The earlier IDOR / CSRF / Stripe-idempotency / OAuth-state / PDF-magic-byte / Helmet-CSP / bcrypt-12 / per-route-throttler controls (codenames C1–C8, H1–H7, M1–M8) are unchanged from the original hardening pass. The 14 controls below (S1–S14) layer on top.

---

## S1 — Brute-force protection (account lockout)

| | |
|---|---|
| Threat | Distributed credential stuffing — attacker rotates IPs through residential proxies. |
| Files | `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`, `backend/src/common/services/audit.service.ts` |
| How | Email-keyed Redis counter (`auth:fail:email:{sha256(email)}`, 15 min window, threshold 10) plus IP-keyed counter (1h window, threshold 50). Lockout returns 429 with `retryAfter`; success clears the counter. |
| Verify | `for i in {1..12}; do curl -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"victim@x.com","password":"wrong"}'; done` — 11th request returns 429. `SELECT * FROM "AuditLog" WHERE action='account_locked' ORDER BY "createdAt" DESC LIMIT 1` shows the row. |
| Operator runbook | Manual unlock: `redis-cli DEL auth:fail:email:<sha256(lowercase email)>`. Reset all email lockouts: `redis-cli --scan --pattern 'auth:fail:email:*' \| xargs redis-cli DEL`. |

## S2 — Email verification gate

| | |
|---|---|
| Threat | Bot signup with disposable email burns Gemini quota and storage. |
| Files | `backend/src/auth/guards/email-verified.guard.ts`, `backend/src/{ai,notes,quizzes,uploads,jobs}/*.controller.ts` (guards on class). |
| How | `EmailVerifiedGuard` runs after `AuthGuard`, queries the `User.emailVerified` column, throws 403 when false. |
| Verify | Register a fresh account, skip the verify link, then `curl -b cookie.txt -X POST $API/upload …` returns 403 with `Email not verified`. After click-through, retry succeeds. |
| Operator runbook | If a user is stuck verified in Supabase but `User.emailVerified=false` locally, `UPDATE "User" SET "emailVerified"=true WHERE id='…';`. |

## S3 — XSS sanitization on AI markdown

| | |
|---|---|
| Threat | Gemini output containing HTML/JS payload renders an `alert()` (or worse) in another user's browser. |
| Files | `frontend/src/lib/sanitizeMarkdown.ts`, `frontend/src/routes/__protected.notes.$noteId.tsx` |
| How | Every markdown string passes through `DOMPurify.sanitize` with a strict allow-list of tags, attrs, and URI schemes. `react-markdown` is configured with `disallowedElements: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button']` and `unwrapDisallowed`. |
| Verify | Render a note with body `<img src=x onerror=alert(1)>foo`. View page — no alert; DevTools shows the `onerror` attribute is absent. |
| Operator runbook | If a feature legitimately needs a new HTML tag, add it to `PURIFY_CONFIG.ALLOWED_TAGS` only after confirming it has no script-bearing attributes. |

## S4 — Hardened HTTP security headers

| | |
|---|---|
| Threat | Click-jacking, Spectre-style cross-origin reads, browser exposing camera/mic/geolocation by default. |
| Files | `backend/src/main.ts` (Helmet + Permissions-Policy middleware) |
| How | Helmet sets CSP / HSTS / referrer-policy / frame-ancestors / COOP / CORP. CSP `imgSrc` is an explicit allow-list (frontend origin + Supabase + Stripe), NOT `https:` wildcard. A custom `Permissions-Policy` middleware denies camera, microphone, geolocation, payment, USB, magnetometer, gyroscope, accelerometer, and interest-cohort. |
| Verify | `curl -I $API/health` shows `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`. Run `https://observatory.mozilla.org` against the deployed origin — score ≥ A. |
| Operator runbook | If an integration needs a new third-party origin, extend `imgSrc`/`connectSrc` directives in `main.ts` rather than reverting to `https:` wildcard. |

## S5 — Body size cap + slow-loris timeouts

| | |
|---|---|
| Threat | Slow-trickle large body or stalled headers tie up a worker indefinitely. |
| Files | `backend/src/main.ts` (`json({limit})`, `urlencoded({limit})`, `server.headersTimeout`, `server.requestTimeout`, `server.keepAliveTimeout`) |
| How | JSON / urlencoded bodies capped at 256 KB. Underlying http server: `headersTimeout = 60s`, `requestTimeout = 30s`, `keepAliveTimeout = 5s`. Stripe webhook path keeps its own `1 MB` raw cap because Stripe payloads are larger. |
| Verify | `python3 -c "import json; print(json.dumps({'x':'A'*300000}))" \| curl -X POST $API/notes -H 'Content-Type: application/json' --data-binary @-` returns 413. |
| Operator runbook | If a legitimate endpoint needs more, raise the cap on a *per-route* basis with a dedicated middleware mount. Do not raise the global cap. |

## S6 — Env validation, `.env.example`, root `.gitignore`

| | |
|---|---|
| Threat | Operator deploys without `STRIPE_WEBHOOK_SECRET` (signature check silently no-ops); accidental commit of `.env`. |
| Files | `backend/src/config/validate-env.ts`, `backend/src/main.ts` (calls validator), `backend/.env.example`, `.gitignore` (root) |
| How | Zod schema parses `process.env` at boot. In production a missing/invalid var calls `process.exit(1)` with a clear message; in dev it logs a warning so contributors can iterate. `.env.example` lists every key with one-line comments. Root `.gitignore` blocks `.env*`, `*.zip`, `*.pem`, `*.key`. |
| Verify | `STRIPE_WEBHOOK_SECRET= NODE_ENV=production npm run start:prod` exits with `Invalid environment configuration`. `git ls-files \| grep -E '\\.env$\|\\.zip$'` is empty. |
| Operator runbook | New env var: add to `validate-env.ts` schema AND `.env.example`. Deploy ordering matters — set the secret in Render before pushing the code that requires it. |

## S7 — Audit-log PII redaction + action whitelist

| | |
|---|---|
| Threat | Future careless caller logs a password or token into `AuditLog.meta`; operator query leaks it. |
| Files | `backend/src/common/services/audit.service.ts` |
| How | `action` is a closed TypeScript union — log injection via newline-stuffed strings is impossible at compile time. `meta` keys matching `password\|token\|secret\|authorization\|cookie\|api_key` are replaced with `[REDACTED]`. String values longer than 1 KB are truncated. Total `meta` JSON > 4 KB is replaced with a marker. `userAgent` is capped at 500 chars. |
| Verify | Call `auditService.record({ action:'login', meta:{ password:'hunter2' } })` — DB row stores `meta.password = '[REDACTED]'`. Calling with an unknown action string fails compile (`error TS2322`). |
| Operator runbook | Adding a new action: extend the `AuditAction` union in `audit.service.ts`; CI typecheck enforces the constraint at every call site. |

## S8 — Stripe webhook replay window

| | |
|---|---|
| Threat | Captured webhook with valid signature replayed months later. |
| Files | `backend/src/subscriptions/webhook.controller.ts` |
| How | Reject events with `event.created` more than 5 min ago (with 30 s clock-skew leeway). Audit the rejection as `webhook_replay_rejected`. The existing `StripeEvent` unique-id table catches exact replays of already-processed events; this catches replays of events we haven't yet seen. |
| Verify | `stripe trigger checkout.session.completed --override-event-created=$(($(date +%s) - 600))` posts a 10-min-old event; backend returns 400 + audit row. |
| Operator runbook | Real Stripe events older than 5 min should never appear (Stripe retries within minutes, exponentially backing off). If a deferred queue ever needs to reprocess older events, do it via a database one-shot, not the webhook endpoint. |

## S9 — WebSocket abuse limits

| | |
|---|---|
| Threat | Authenticated abuser floods `/jobs` namespace with 1000 msg/sec or sends a 100 MB frame, OOMing the worker. |
| Files | `backend/src/websocket/websocket.gateway.ts` |
| How | Socket.IO `maxHttpBufferSize: 64 KB`. Per-connection inbound message rate limit of 30 msg/sec backed by Redis (`ws:msg:{userId}:{socketId}` with 1 s TTL); breach disconnects the socket. Concurrent connections per user capped at 5 via Redis set (`ws:conns:{userId}`); 6th handshake refused with `Too many concurrent sessions`. Set is cleaned on disconnect. |
| Verify | Node script that emits 100 events in a tight loop disconnects at message 31. Six parallel sockets from the same user — 6th rejected at handshake. Send 100 KB payload — disconnected with `WS_ERR_FRAME_TOO_LARGE`. |
| Operator runbook | If a legitimate use ever needs more, raise the threshold in the gateway constants block. Do not remove the limit. |

## S10 — File-upload filename hardening

| | |
|---|---|
| Threat | Filename `../../etc/passwd.pdf` traverses out of the user's storage prefix; `.html` filename served inline executes JS in our origin. |
| Files | `backend/src/uploads/pdf.service.ts` |
| How | Sanitiser slugifies filenames to `[a-z0-9.\-_]`, collapses repeated dots, strips leading dots, caps at 80 chars. Final upload path must split into exactly two segments (`<userId>/<filename>`) and contain no `..` or `\`; otherwise the upload is rejected. |
| Verify | Upload with filename `../../etc/passwd.pdf` — server stores at `<userId>/<ts>-_._.._etcpasswd.pdf` (or rejects); never traverses out. Upload with `.htaccess.pdf` — leading dot stripped, stored as `htaccess.pdf`. |
| Operator runbook | If filename rules need tightening (e.g. ban specific extensions), extend the sanitiser block; prefer denying at upload over filtering on serve. |

## S11 — CSRF double-submit token

| | |
|---|---|
| Threat | Sub-domain takeover or weak SameSite policy lets attacker issue authenticated state-changing requests. |
| Files | `backend/src/common/middleware/csrf.middleware.ts`, `backend/src/main.ts` (mounts middleware), `backend/src/auth/auth.controller.ts` (`/auth/me` and `/auth/csrf` issue cookie), `frontend/src/lib/api.ts` (request interceptor reads cookie, sets header) |
| How | Backend issues a non-httpOnly `csrf_token` cookie (32 bytes random hex, 24 h max-age, SameSite per env). Frontend axios interceptor reads it and echoes as `X-CSRF-Token` on every non-safe request. Backend middleware compares cookie ↔ header with `crypto.timingSafeEqual`; mismatch → 403. Stripe webhook + bootstrap auth routes (`/auth/login`, `/auth/register`, `/auth/oauth*`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-verification`, `/auth/csrf`) are exempt. |
| Verify | `curl -b "access_token=…; csrf_token=A" -H 'X-CSRF-Token: B' -X POST $API/notes` returns 403 `CSRF token mismatch`. Same with matching tokens succeeds. From a browser: visit a malicious page that issues `fetch($API/notes, { method:'POST', credentials:'include' })` — request rejected because the cross-origin script can't read the cookie. |
| Operator runbook | Adding a new public mutation route (rare): extend `EXEMPT_PATHS` only after confirming it has its own CSRF-equivalent (e.g. signed payload, captcha). |

## S12 — OAuth open-redirect whitelist

| | |
|---|---|
| Threat | Phishing via `/supabaseCallback?redirect=https://attacker.com` lands the user on the attacker's site immediately after a real login. |
| Files | `frontend/src/lib/safeRedirect.ts`, `frontend/src/routes/supabaseCallback.tsx` |
| How | `safeRedirect(raw)` rejects any value that contains `://`, starts with `//`, or doesn't begin with `/`. Path must match (or nest under) one of `{/library, /notes, /quizzes, /tutor}`. Anything else falls back to `/library`. |
| Verify | Visit `/supabaseCallback?redirect=https://google.com` — lands on `/library`. Visit `/supabaseCallback?redirect=//evil.com` — lands on `/library`. Visit `/supabaseCallback?redirect=/notes/abc` — lands on `/notes/abc`. |
| Operator runbook | Need a new safe destination: extend `ALLOWED_PATHS` set in `safeRedirect.ts`. |

## S13 — Restored AuditLog / StripeEvent migration

| | |
|---|---|
| Threat | Fresh deploy or `prisma migrate reset` doesn't create the tables; audit + webhook idempotency throw at runtime. |
| Files | `backend/prisma/migrations/20260505120000_add_audit_log_and_stripe_event_tables/migration.sql` |
| How | Hand-written SQL matching the Prisma schema models — `AuditLog` (id pk, userId, action, target, ip, userAgent, meta JSONB, createdAt) with three indexes; `StripeEvent` (id pk, type, processedAt) with one index. |
| Verify | `npx prisma migrate reset --force` on dev creates both tables. Trigger a login, then `SELECT count(*) FROM "AuditLog" WHERE action='login'` returns ≥ 1. Stripe-cli replay of the same event id twice — second returns `{received:true, duplicate:true}`. |
| Operator runbook | If a future schema change touches either table, generate a new migration via `prisma migrate dev --name …`. Never edit the existing one in place once deployed. |

## S14 — CI security gates

| | |
|---|---|
| Threat | Vulnerable transitive dep, accidentally committed secret, schema drift between `schema.prisma` and migrations folder. |
| Files | `.github/workflows/ci.yml` |
| How | Existing pipeline plus three new gates: (a) `npm audit --audit-level=high` on backend AND frontend (fails the PR on any high/critical advisory); (b) `prisma format --check` + `prisma validate` (catches schema drift); (c) `gitleaks-action` SHA-pinned scan on the diff (and full repo on push to main). All actions reference commit SHAs, not version tags, to defend against tag-shift attacks. |
| Verify | Open a PR adding a vulnerable old `lodash@4.17.10` — `npm audit` step fails. Open a PR with a fake AWS-shaped key in a fixture — gitleaks blocks it. Open a PR that changes `schema.prisma` without a migration — `prisma validate` warns. |
| Operator runbook | New CI pin: replace the SHA, then run the workflow once on a throwaway branch to confirm it still functions. Pin only via `@<full-sha>`, never `@v1`. |

---

## End-to-end demo plan

A 30-minute live walkthrough — each step ~2 minutes, clear pass/fail signal:

| # | Control | Probe | Expected |
|---|---|---|---|
| 1 | S1 | 12 wrong-password logins | 11th returns 429, AuditLog row exists |
| 2 | S2 | New unverified account hits `POST /upload` | 403 `Email not verified` |
| 3 | S3 | Render note with `<img src=x onerror=alert(1)>` | No alert; attribute stripped |
| 4 | S4 | `curl -I /health` | Permissions-Policy / COOP / CORP headers present |
| 5 | S5 | POST 300 KB JSON | 413 |
| 6 | S6 | Boot with blank `STRIPE_WEBHOOK_SECRET` (NODE_ENV=production) | Exit code 1 with clear error |
| 7 | S7 | `auditService.record({ meta:{ password:'…' } })` | DB row stores `[REDACTED]` |
| 8 | S8 | Replay 6-min-old webhook | 400 + audit row |
| 9 | S9 | 100 ws messages or 6 sockets | Disconnect at #31 / handshake refused at #6 |
| 10 | S10 | Upload `../../etc/passwd.pdf` | Stored under `<userId>/`, no traversal |
| 11 | S11 | `curl` POST without `X-CSRF-Token` | 403 `CSRF token missing` |
| 12 | S12 | `/supabaseCallback?redirect=https://google.com` | Lands on `/library` |
| 13 | S13 | `prisma migrate reset --force` then login | Tables created, audit row written |
| 14 | S14 | PR adding `lodash@4.17.10` | `npm audit` step fails the PR |

---

## Verification gates before merge

```bash
cd backend  && npx tsc --noEmit && npm test
cd frontend && npx tsc --noEmit -p tsconfig.app.json && npm run build && ! ls dist/**/*.map 2>/dev/null
cd backend  && npx prisma validate && npx prisma format --check
```

Live deployment also passes:

- `https://observatory.mozilla.org/analyze` ≥ A
- `https://securityheaders.com` ≥ A

---

## Inventory — quick scan

| Code | Control | Status |
|---|---|---|
| S1 | Account lockout / brute-force | ✅ |
| S2 | Email-verified guard | ✅ |
| S3 | DOMPurify markdown sanitization | ✅ |
| S4 | Hardened security headers | ✅ |
| S5 | Body cap + slow-loris timeouts | ✅ |
| S6 | Env validation + `.env.example` + root `.gitignore` | ✅ |
| S7 | Audit-log PII redaction + action whitelist | ✅ |
| S8 | Stripe webhook replay window | ✅ |
| S9 | WebSocket abuse limits | ✅ |
| S10 | File-upload filename hardening | ✅ |
| S11 | CSRF double-submit token | ✅ |
| S12 | OAuth open-redirect whitelist | ✅ |
| S13 | AuditLog + StripeEvent migration restored | ✅ |
| S14 | CI security gates | ✅ |

14 / 14 controls live. See `/home/vanex/.claude/plans/i-want-you-to-lucky-bunny.md` for the planning rationale and per-control speaker notes (PPT-friendly).
