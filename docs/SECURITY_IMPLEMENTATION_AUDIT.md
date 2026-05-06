# Security Implementation Audit — Critical Controls

A focused map of the **10 critical security controls** protecting AI-Study-Buddy.
Each entry shows the **purpose**, **how it works**, where the protection lives in
code, the threat it defeats, and how to confirm it. Use this doc as the basis
for the Information Security final-project presentation.

> Status legend
> &nbsp;&nbsp;✅  fully implemented and active in code
>
> Status counts: **10 / 10 ✅**

---

## Threat model in one paragraph

AI-Study-Buddy is a multi-tenant SaaS that handles user accounts, file
uploads, an LLM API quota (Google Gemini), and Stripe payments. The realistic
attackers are: credential stuffers, IDOR-hunters, malware upload attempts,
disposable-email Gemini-quota burners, payment forgery scripts, and standard
browser-based XSS / CSRF / clickjacking. The 10 controls below address each
of those classes.

---

## 1. Password storage — bcrypt cost factor 12

**Purpose.** Make stolen password databases useless to attackers. Even if
the entire `User` table leaks, no attacker can recover the original passwords
in a reasonable time.

**How it works.** When a user registers, the server runs `bcrypt.hash(password, 12)`.
bcrypt is a deliberately slow hashing function: cost factor 12 means the hash
is computed `2^12` (4 096) times per password — about 250 ms on a modern CPU.
The output (a one-way digest, ~60 chars long, format `$2b$12$<salt><hash>`)
is stored in `User.password`. On login, bcrypt re-hashes the submitted
password with the same salt and compares; the original password is never
written anywhere. An attacker who steals the DB has to brute-force every
guess at 250 ms each — roughly 4× slower than the default cost-10 setup,
which makes offline cracking economically infeasible for strong passwords.

| | |
|---|---|
| **Status** | ✅ |
| **File** | `backend/src/auth/auth.service.ts` |
| **Code** | `await bcrypt.hash(password, 12)` |
| **Threat** | Database leak handing out plaintext passwords. |
| **Why this knob** | Cost 12 ≈ 250 ms per hash on commodity hardware — ~4× harder to crack offline than the cost-10 default. |
| **Verify** | Query `SELECT password FROM "User" LIMIT 1;` — should start with `$2a$12$...` or `$2b$12$...`, never plaintext. |

---

## 2. Session token in httpOnly + Secure cookie

**Purpose.** Prevent JavaScript on the page (legitimate or malicious) from
ever touching the session token. Even if an XSS bug ships, the attacker's
script can't steal the user's session.

**How it works.** After a successful login, the backend sets the JWT in a
cookie with three flags: `httpOnly: true` (browser refuses to expose it to
`document.cookie` or `fetch()` reads), `secure: true` in production (cookie
only sent over HTTPS), and `sameSite: 'none'` cross-site or `'lax'` same-site
(controls when the cookie travels). The browser still attaches the cookie
automatically to every request to the backend (`withCredentials: true` on
the frontend), so the user remains logged in — but no JS can read it. CSRF
is handled separately by a double-submit token (`csrf_token` cookie + matching
header on every state-changing request).

| | |
|---|---|
| **Status** | ✅ |
| **File** | `backend/src/auth/auth.service.ts` — `setAuthCookie()` |
| **Settings** | `httpOnly: true`, `secure: NODE_ENV === 'production'`, `sameSite: 'none' \| 'lax'`, 7-day TTL |
| **Threat** | XSS payload reading `document.cookie` to steal the session. |
| **Verify** | Browser console: `document.cookie` shows `csrf_token`, `sidebar_state`, etc. — but **not** `access_token`. |

---

## 3. Email verification gate

**Purpose.** Make sure every account is tied to a real inbox the user
controls before they can call expensive backend services. Specifically
stops bots from spinning up disposable accounts to burn the Gemini API
quota or fill storage.

**How it works.** On registration, Supabase sends a confirmation email with
a one-time link. Clicking the link returns the user to `/supabaseCallback`
with a short-lived access token; the frontend forwards it to
`/auth/verify-email/callback`, the backend validates the token via
`supabase.auth.getUser()`, confirms `email_confirmed_at` is set, and flips
the local `User.emailVerified` column to `true`. Until that flag is `true`,
`AuthService.Login()` refuses to issue a session, and every protected
controller (AI, Notes, Quizzes, Uploads, Jobs) runs `EmailVerifiedGuard`
which throws 403 if the flag is still false. Idempotent — clicking the
link twice is a no-op.

| | |
|---|---|
| **Status** | ✅ |
| **Files** | `backend/src/auth/guards/email-verified.guard.ts` (gate); `backend/src/auth/auth.service.ts` `confirmEmailVerification()` (state flip); `frontend/src/routes/supabaseCallback.tsx` (link callback) |
| **Applied on** | AI controllers, Notes, Quizzes, Uploads, Jobs |
| **Threat** | Bots with throwaway addresses burning the Gemini API quota or filling storage before any human owner is established. |
| **Verify** | Register, do **not** click the email link, try to log in → blocked with "Please verify your email". Click link → DB row flips `emailVerified=true`, login succeeds. |

---

## 4. Brute-force lockout + Redis-backed rate limiter

**Purpose.** Stop password-guessing attacks. Whether the attacker is a
single bot or a botnet rotating IPs, both individual accounts and the
overall server stay protected from credential-stuffing floods.

**How it works.** Two layers. The **per-route rate limiter** decorates
endpoints with `@Throttle(limit, ttl)`; under the hood `RedisThrottlerGuard`
runs an atomic Lua script (`INCR + EXPIRE` in one round trip) so requests
are counted accurately even under concurrency, and replies with
HTTP 429 + `Retry-After` when the cap is exceeded. On top of that, the
**brute-force lockout** in `auth.service.ts` increments a per-email counter
on every failed login (`recordFailedLogin`); after 3 fails inside 60 seconds
the account is locked and `assertNotLocked()` rejects further attempts —
even the correct password — until the TTL expires. A coarser per-IP counter
catches distributed attacks where each email gets few attempts but a single
network hammers many emails. Both counters reset cleanly on a successful
login.

| | |
|---|---|
| **Status** | ✅ |
| **Files** | `backend/src/common/guards/redis-throttler.guard.ts` (Lua-atomic `INCR + EXPIRE`); `backend/src/auth/auth.service.ts` (`assertNotLocked`, `recordFailedLogin`) |
| **Knobs** | 3 wrong logins / 60 s lock per email; 50 fails / hour per IP. Per-route `@Throttle(limit, ttl)` decorator otherwise. |
| **Threat** | Credential stuffing — millions of leaked passwords being tried against your endpoint. |
| **Verify** | Type wrong password 3× — 4th attempt with the **correct** password is also rejected with "Account temporarily locked. Try again in 60 seconds." |

---

## 5. Tenant isolation — IDOR defence

**Purpose.** Make sure every user can only read, edit, or delete their own
data. Closes the most common bug class on multi-tenant apps —
**Insecure Direct Object Reference** (OWASP A01, the #1 risk in the OWASP
Top 10) — where Bob types Alice's note ID into the URL and sees Alice's data.

**How it works.** The user's identity is **always** derived from the JWT —
never from the request body, query string, or URL parameter. The
`@CurrentUser('id') userId: string` decorator pulls the ID out of
`request.user` (set by `AuthGuard` after JWT verification) and throws 401
if the guard didn't run. Every service-layer query then includes
`where: { id, userId }` — Prisma turns that into a SQL `WHERE` clause that
returns no row when the requested ID belongs to someone else. The
controller sees `null`, returns 404. The same rule applies to the
WebSocket gateway: `userOwnsJob()` checks ownership before joining a
job-progress room. There is no code path where a request body's
`userId` is trusted.

| | |
|---|---|
| **Status** | ✅ |
| **Files** | `backend/src/auth/decorators/current-user.decorator.ts` (user ID from JWT only); `notes.service.ts`, `quizzes.service.ts`, `pdf.service.ts` (every query has `where: { id, userId }`) |
| **Pattern** | Controllers use `@CurrentUser('id') userId: string` — never `req.body.userId`. |
| **Threat** | Bob typing Alice's note ID in the URL and seeing Alice's data (Insecure Direct Object Reference, OWASP #1). |
| **Verify** | Two browsers, two accounts. Account A creates a note, copies the ID. Account B pastes the URL → 404, not Alice's note. Same for quizzes / uploads / job rooms. |

---

## 6. Strict input validation (whitelist + transform)

**Purpose.** Reject any request carrying fields the server doesn't expect.
Specifically blocks **mass assignment** — the attack where a request body
smuggles privileged fields like `"role": "ADMIN"` or `"userId": "<victim>"`
to escalate privilege or impersonate.

**How it works.** A single global `ValidationPipe` runs on every incoming
request. With `whitelist: true` it strips any property not declared on the
target DTO; with `forbidNonWhitelisted: true` it goes further and rejects
the request outright with 400 + a list of disallowed fields. The DTOs
themselves use `class-validator` decorators (`@IsString`, `@IsEmail`,
`@IsUUID`, `@MinLength`, `@MaxLength`, `@IsEnum`) so type, format, and
length are checked before the controller method ever runs. `transform: true`
auto-converts incoming JSON values to the declared TS types (string `"42"`
→ number `42`) so downstream code can trust the shape. Combined with
Prisma — which only writes columns that exist on the model — even a
field that slipped through validation can't reach an unintended column.

| | |
|---|---|
| **Status** | ✅ |
| **File** | `backend/src/main.ts` — `useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` |
| **Plus** | DTOs across every module use `@IsString`, `@IsEmail`, `@IsUUID`, `@MinLength`, `@MaxLength`, `@IsEnum` from `class-validator`. |
| **Threat** | Mass-assignment — a request body smuggling `"role": "ADMIN"` or `"userId": "<victim>"` into a model. |
| **Verify** | Console: `fetch('/notes', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json','X-CSRF-Token':...}, body:JSON.stringify({title:'x',content:'x',role:'ADMIN'}) })` → 400 "property role should not exist", **or** the saved row has no `role` field. |

---

## 7. File upload — MIME + size + magic-byte triple check

**Purpose.** Make sure an uploaded file is actually a PDF, not malware
disguised as one. Three independent checks stack so each one catches what
the others miss.

**How it works.** When a file arrives at `/upload`, `pdf.service.ts` runs
three sequential validations on the raw buffer. **Layer 1 — MIME type:**
`file.mimetype` must equal `application/pdf`; this catches lazy attackers
who just renamed a `.png` to `.pdf` (the browser still sends `image/png`).
**Layer 2 — size cap:** `file.size > 10 * 1024 * 1024` rejected; protects
the disk and the PDF parser from DoS via a 10 GB upload. **Layer 3 — magic
bytes:** the first four bytes of `file.buffer` must equal `%PDF`
(`0x25 0x50 0x44 0x46`). This is the strongest layer: an attacker can
forge the MIME header in a crafted HTTP request, but they cannot lie
about the actual content of the bytes. Finally, the **filename is
sanitized** through a whitelist regex (`/[^a-zA-Z0-9.-]/g → _`), capped at
80 chars, and rejected outright if it still contains `..`, `/`, or `\` —
defence-in-depth against path traversal even if the storage backend is
permissive.

| | |
|---|---|
| **Status** | ✅ |
| **File** | `backend/src/uploads/pdf.service.ts` |
| **Checks** | `mimetype === 'application/pdf'`; `size ≤ 10 MB`; first 4 bytes of `file.buffer` equal `%PDF` (`0x25 50 44 46`); filename slugified to `[a-z0-9._-]`, capped at 80 chars, `..` / `/` / `\` blocked. |
| **Threat** | Malware disguised as a PDF; oversize uploads exhausting disk; path-traversal filenames. |
| **Verify** | Rename a `.png` to `fake.pdf`, upload → rejected. Try a 12 MB file → rejected. Try `../../sketch.pdf` → either rejected or stored as `sketch.pdf`. |

---

## 8. Safe error responses — no stack-trace leaks

**Purpose.** Make sure server crashes and internal errors never leak
sensitive details (library versions, file paths, SQL fragments, schema
names) to the wire. Information disclosure is the reconnaissance step of
every targeted attack — taking it away forces attackers to test blindly.

**How it works.** A global `AllExceptionsFilter` catches every uncaught
exception at the framework boundary. If the exception is a known
`HttpException` (e.g. 400 from validation, 404 from a missing row), it
forwards the status and a curated message — no stack trace. If it is
**anything else** (a Prisma error, a TypeError, a runtime crash), it
collapses the response to a generic
`{ statusCode: 500, message: 'Internal server error', requestId: <uuid> }` —
the full stack lands only in the server logs against that requestId, so
operators can still diagnose without exposing internals. On the frontend,
`api.ts` adds a second layer: an Axios response interceptor inspects the
status code and replaces the body with a generic `{ message: 'Request failed' }`
unless the status is in `USER_SAFE_STATUSES = [400, 422, 429]` — those are
safe to surface verbatim because they're user-correctable validation /
rate-limit errors.

| | |
|---|---|
| **Status** | ✅ |
| **Files** | `backend/src/common/filters/all-exceptions.filter.ts` (catch-all → generic 500 + requestId, full stack server-side only); `frontend/src/lib/api.ts` (`USER_SAFE_STATUSES = [400, 422, 429]`, all other 4xx bodies replaced with `{ message: 'Request failed' }`) |
| **Threat** | A stack trace exposing library versions, file paths, and SQL fragments — the reconnaissance step of every targeted attack. |
| **Verify** | `fetch('/notes/non-existent', { credentials:'include' })` → response is `{ statusCode:404, message:'Note not found' }` or generic 500 with `requestId`. No stack, no file paths, no library names. |

---

## 9. Security headers + strict CORS

**Purpose.** Hand the browser a clear set of rules so it refuses to do the
things browsers will otherwise do by default — embed the page in a
malicious frame, run inline scripts, fall back to HTTP, leak the URL via
`Referer`, share cookies with random origins. These headers cost nothing
at runtime and block whole classes of browser-side attacks.

**How it works.** Helmet middleware sets six headers on every response.
**Content-Security-Policy** lists exactly which origins can serve scripts,
styles, images, and outbound `fetch()` calls — anything else is blocked,
which neuters reflected and inline-script XSS.
**Strict-Transport-Security** with a 1-year `max-age` + `preload` tells
browsers (and Chrome's preload list) that this site is HTTPS-only,
preventing TLS-downgrade MITM attacks. **frame-ancestors 'none'** prevents
the page from being embedded in any `<iframe>`, killing clickjacking.
**X-Content-Type-Options: nosniff** forbids the browser from second-guessing
declared MIME types, defeating MIME-confusion attacks. **Referrer-Policy:
strict-origin-when-cross-origin** strips the path/query when a request
crosses to another origin, so URL-embedded tokens don't leak via `Referer`.
**Permissions-Policy** denies camera, microphone, geolocation, and payment
APIs at the top frame, so even a compromised script in our origin can't
prompt for them. CORS itself is pinned to the exact `FRONTEND_URL` —
no wildcard — so cookies (`credentials: true`) only travel to our own
frontend, and a malicious site can't make authenticated requests on the
user's behalf.

| | |
|---|---|
| **Status** | ✅ |
| **File** | `backend/src/main.ts` (Helmet config + custom `Permissions-Policy`) |
| **Headers** | `Content-Security-Policy` (explicit `defaultSrc/scriptSrc/styleSrc/imgSrc/connectSrc`, `frameAncestors:'none'`, `objectSrc:'none'`); `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`. |
| **CORS** | `app.enableCors({ origin: FRONTEND_URL, credentials: true, allowedHeaders: 'Content-Type, Accept, Authorization, X-CSRF-Token' })` — no wildcards. |
| **Threat** | XSS, clickjacking, MITM downgrade, cross-origin requests stealing cookies. |
| **Verify** | DevTools → Network → click document request → Response Headers shows all of the above. From `https://example.com` console, `fetch('http://localhost:3000/auth/me', { credentials:'include' })` triggers a CORS error. |

---

## 10. Stripe webhook integrity — signature + idempotency

**Purpose.** Make sure subscription state in our database can only be
changed by genuine, fresh, single-delivery messages from Stripe. Closes
three real attacks at once: forged webhooks promoting attackers to PRO,
replayed week-old events, and Stripe's own duplicate retries
double-billing the user.

**How it works.** Three layers stack on every `/webhooks/stripe` POST.
**Layer 1 — signature verification:** `Stripe.webhooks.constructEvent()`
takes the raw request body, the `Stripe-Signature` header, and our
`STRIPE_WEBHOOK_SECRET`, recomputes the HMAC, and throws if it doesn't
match. The `/webhooks/stripe` route is mounted with `raw({ type: 'application/json' })`
**before** the JSON parser in `main.ts` so the byte-for-byte payload is
preserved — JSON re-encoding would break the signature. **Layer 2 — replay
window:** the verified event's `event.created` timestamp is compared to
`Date.now()`; anything older than 5 minutes plus 30 seconds of clock skew
is rejected and audited as `webhook_replay_rejected`. **Layer 3 —
idempotency:** the very first thing after signature passes is
`prisma.stripeEvent.create({ data: { id: event.id } })` — Stripe's event
ID is the primary key. A duplicate delivery hits the unique constraint,
the handler catches it and returns `{ received: true, duplicate: true }`
without touching the subscription state. The `User`-to-`Customer` mapping
goes through our server-stored `stripeCustomerId` only — the webhook
payload's `client_reference_id` is never trusted to grant Pro to a
forged userId.

| | |
|---|---|
| **Status** | ✅ |
| **Files** | `backend/src/stripe/stripe.service.ts` — `Stripe.webhooks.constructEvent(rawBody, signature, secret)`; `backend/src/subscriptions/webhook.controller.ts` — 5-min replay window + `databaseService.stripeEvent.create({ data: { id, type } })` (unique constraint = idempotency); `backend/src/main.ts` — `/webhooks/stripe` mounted with raw body parser **before** the JSON parser. |
| **Threat** | A forged `customer.subscription.created` upgrading an attacker to PRO; Stripe retries duplicating subscription credit; replayed week-old events. |
| **Verify** | `curl -X POST /webhooks/stripe -d '{"type":"customer.subscription.created"}'` → 400 (no valid signature). Re-send a real Stripe event → second delivery returns `{ duplicate: true }`. |

---

## Verification commands

A 60-second sanity sweep that confirms each control's code is still in place:

```bash
# 1, 2, 3, 5, 7  — code presence
grep -rln "bcrypt.hash([^,]*,\\s*12"            backend/src
grep -rln "EmailVerifiedGuard"                   backend/src
grep -rln "@CurrentUser"                         backend/src
grep -rln "0x25.*0x50.*0x44.*0x46\|application/pdf" backend/src/uploads

# 4  — rate limiter + lockout
grep -rln "RedisThrottlerGuard\|recordFailedLogin\|assertNotLocked" backend/src

# 6  — validation
grep -n "whitelist:.*true\|forbidNonWhitelisted" backend/src/main.ts

# 8  — error filter
grep -n "AllExceptionsFilter\|USER_SAFE_STATUSES" backend/src frontend/src

# 9  — headers + CORS
grep -n "contentSecurityPolicy\|enableCors\|Permissions-Policy" backend/src/main.ts

# 10 — Stripe
grep -n "constructWebhookEvent\|stripeEvent.create" backend/src/subscriptions backend/src/stripe
```

Hands-on tests for each control live in `SECURITY_TESTING_GUIDE.md`.

---

## Result

**10 of 10 critical controls implemented.** The realistic attacker classes
listed in the threat model are each blocked by at least one control above.

Additional defence-in-depth controls (audit logging, OAuth state nonce,
WebSocket auth, COOP/CORP, full logout, action-enum log-injection guard,
secret rotation runbook, CI dependency pinning, etc.) ship with the project
but are out of scope for this presentation. They live in the codebase and
the project's `SECURITY.md` runbook for operators.
