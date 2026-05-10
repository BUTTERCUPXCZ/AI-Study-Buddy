# AI-Study-Buddy — Final Project Presentation

Technical documentation for the Week 9 final presentation.
Companion to `docs/SECURITY_IMPLEMENTATION_AUDIT.md` (control map),
`docs/SECURITY_TESTING_GUIDE.md` (hands-on tests), and `SECURITY.md`
(ops runbook).

---

## System Title

**AI-Study-Buddy** (a.k.a. **Buds**) — AI-powered study platform.

Repo: `AI-Study-Buddy/` · Frontend: Vercel · Backend: Render · DB:
PostgreSQL · Cache/Queue: Upstash Redis · Auth: Supabase · AI: Google
Gemini 2.5-flash · Payments: Stripe.

---

## System Purpose

AI-Study-Buddy turns a student's PDF lecture material into structured
study notes, generates multiple-choice quizzes from those notes, and
provides a streaming AI tutor for follow-up questions. Real-time job
progress is pushed via WebSocket so the user sees PDF processing happen
live.

Built for: students and self-learners who need to compress dense reading
material into reviewable notes and self-test quickly. Free tier covers 5
generations; ₱100/month Pro subscription unlocks unlimited use.

Problem solved: Reading → summarizing → quizzing yourself is slow manual
work. The system collapses it into one upload.

---

## Core Features

1. **PDF Upload + AI Note Generation**
   Drag-and-drop PDF upload (max 10 MB). Stored in Supabase storage;
   processed asynchronously via BullMQ workers. Gemini 2.5-flash extracts
   and reformats content into Markdown notes. Real-time progress over
   Socket.io (`/jobs` namespace).

2. **Quiz Generation from Notes**
   One click: "Generate quiz from this note" → AI produces 10 MCQs with
   explanations. Take quiz inline, score saved per attempt.

3. **AI Tutor (Streaming Chat)**
   SSE-streamed responses from Gemini. Optional note context: ask
   questions grounded in a specific note. Sessions persisted in Postgres
   so history survives navigation.

4. **PDF Library**
   Browse, preview, and delete uploaded PDFs. Per-user isolation enforced
   server-side.

5. **Subscription / Billing**
   Stripe Checkout for ₱100/mo Pro plan. Webhook drives subscription
   state in DB. Usage guard caps free users at 5 attempts.

6. **Auth (Email + OAuth)**
   Email + password (bcrypt hashed at cost 12) and OAuth via Supabase
   (Google, GitHub, Facebook, Twitter, Azure, LinkedIn). httpOnly cookie
   session (no JWT in JS).

UI screenshot files live under `docs/ui/`. Capture from running app
before slides are exported.

---

## Target Users

| Role | Who | Capabilities |
|---|---|---|
| **Free user** (default) | Any registered student | 5 total AI generations (notes + quizzes combined); unlimited tutor chat (rate-limited 20/min); read/write own notes, quizzes, files; manage own tutor sessions. |
| **Pro user** | Free user who completes Stripe checkout | All Free capabilities without the 5-attempt cap. Subscription auto-managed via Stripe webhooks. |
| **Unauthenticated visitor** | Anyone | Landing page, pricing, sign-up, login, password reset. Cannot reach any data endpoint. |
| **System (Stripe webhook)** | Stripe servers | Single endpoint `/webhooks/stripe`. Identity proven by signature, not session. |

There is no admin or staff role in the live app — administrative actions
(user lookup, refund, etc.) are performed via the Render / Stripe /
Supabase dashboards out-of-band. This is a deliberate scope limit.

---

## Security Implementations

The system implements **10 critical security controls** mapped to the
OWASP Top 10 and the CIA triad. Every control below has a **purpose**
(why it exists) and a **how it works** explanation (the actual mechanism),
followed by file paths and the threat it defeats. Hands-on tests for each
are in `docs/SECURITY_TESTING_GUIDE.md`. Full reference is in
`docs/SECURITY_IMPLEMENTATION_AUDIT.md`.

> **Threat model:** AI-Study-Buddy is a multi-tenant SaaS handling
> accounts, file uploads, an LLM API quota, and Stripe payments. Realistic
> attackers: credential stuffers, IDOR-hunters, malware-upload attempts,
> disposable-email Gemini-quota burners, payment forgery scripts, and
> standard browser-based XSS / CSRF / clickjacking.

---

### A. Authentication (4 controls)

#### A.1 — Bcrypt cost factor 12 (password hashing)

**Purpose.** Make stolen password databases useless. Even if the entire
`User` table leaks, no attacker can recover the original passwords in
reasonable time.

**How it works.** `bcrypt.hash(password, 12)` runs the password through
4 096 iterations of the bcrypt KDF — about 250 ms per hash on a modern
CPU. The output (~60 chars, format `$2b$12$<salt><hash>`) is stored in
`User.password`. On login, bcrypt re-hashes the submitted password with
the same salt and compares. The original password is never written
anywhere. Cost 12 is ~4× harder to crack than the default cost 10, which
makes offline brute-force economically infeasible for strong passwords.

| Where | Threat |
|---|---|
| `backend/src/auth/auth.service.ts` — `bcrypt.hash(password, 12)` | Offline cracking of leaked password DB |

**Verify (1 min).**
1. Register a new user via `/register`.
2. Open the DB (Render dashboard → SQL editor): `SELECT email, password FROM "User" ORDER BY "createdAt" DESC LIMIT 1;`
3. **Expected ✅:** `password` starts with `$2a$12$...` or `$2b$12$...`. **Not** the plaintext password you typed.

---

#### A.2 — httpOnly + Secure + SameSite cookie

**Purpose.** Prevent JavaScript on the page from ever touching the
session token. Even if an XSS bug ships, the attacker's script can't
steal the user's session.

**How it works.** After successful login, the backend's `setAuthCookie()`
writes the JWT into a cookie with three flags: `httpOnly: true` (browser
refuses to expose it to `document.cookie` or `fetch()`); `secure: true`
in production (cookie only travels over HTTPS); `sameSite: 'none' | 'lax'`
(controls cross-origin cookie behaviour). The browser still attaches
the cookie automatically to every backend request (frontend uses
`withCredentials: true`), so the user remains logged in — but no JS can
read it. CSRF is handled separately via a double-submit `csrf_token`
cookie + matching header.

| Where | Threat |
|---|---|
| `backend/src/auth/auth.service.ts:setAuthCookie` | XSS-driven session theft |

**Verify (30 sec).**
1. Log in normally.
2. DevTools → Console → type `document.cookie` → Enter.
3. **Expected ✅:** Output shows `csrf_token=...`, `sidebar_state=...` — but **not** `access_token`. In Application → Cookies → `access_token` row, `HttpOnly = ✓`, `Secure = ✓` (production).

---

#### A.3 — Email-verification gate

**Purpose.** Tie every account to a real inbox the user controls before
they can call expensive backend services. Stops bots from spinning up
disposable accounts to burn the Gemini API quota or fill storage.

**How it works.** On registration, Supabase sends a confirmation email
with a one-time link. Clicking it returns the user to `/supabaseCallback`
with a short-lived access token; the frontend forwards it to
`/auth/verify-email/callback`, the backend validates via
`supabase.auth.getUser()`, confirms `email_confirmed_at` is set, and
flips the local `User.emailVerified` column to `true`. Until that flag
is true, `AuthService.Login()` refuses to issue a session, and every
protected controller (AI, Notes, Quizzes, Uploads, Jobs) runs
`EmailVerifiedGuard` which throws 403 if the flag is still false.
Idempotent — clicking the link twice is a no-op.

| Where | Threat |
|---|---|
| `backend/src/auth/guards/email-verified.guard.ts`; `auth.service.ts:confirmEmailVerification` | Bots with throwaway addresses burning Gemini quota |

**Verify (2 min).**
1. Register a new user. **Don't** click the email link yet.
2. Try to log in → **Expected ✅:** rejected with *"Please verify your email first"*.
3. Click the confirmation link in the inbox.
4. Try logging in again → **Expected ✅:** succeeds. DB shows `emailVerified=true`.
5. Backend logs show `event=email_verify_success userId=...`.

---

#### A.4 — Brute-force lockout + Redis rate limiter

**Purpose.** Stop password-guessing attacks. Whether the attacker is a
single bot or a botnet rotating IPs, both individual accounts and the
overall server stay protected from credential-stuffing floods.

**How it works.** Two layers. The **per-route rate limiter** decorates
endpoints with `@Throttle(limit, ttl)`; under the hood `RedisThrottlerGuard`
runs an atomic Lua script (`INCR + EXPIRE` in one round trip) so requests
are counted accurately under concurrency, and replies with HTTP 429 +
`Retry-After` when exceeded. On top of that, the **brute-force lockout**
in `auth.service.ts` increments a per-email counter on every failed
login (`recordFailedLogin`); after 3 fails inside 60 seconds the account
is locked, and `assertNotLocked()` rejects further attempts — even the
correct password — until TTL expires. A coarser per-IP counter catches
distributed attacks. Both counters reset cleanly on a successful login.

| Where | Threat |
|---|---|
| `backend/src/common/guards/redis-throttler.guard.ts`; `auth.service.ts:assertNotLocked, recordFailedLogin` | Credential stuffing, brute-force, DoS via flood |

**Verify (1 min — live demo material).**
1. On `/login`, type your real email + a wrong password. Submit.
2. Repeat 3 times.
3. On attempt 4, type the **correct** password.
4. **Expected ✅:** *"Account temporarily locked. Try again in 60 seconds."* Even the correct password is rejected. Wait 60 s, login works.
5. Backend logs show `WARN [HTTP] <- POST /auth/login 429 ... user=anon` per failed attempt + audit row `account_locked`.

---

### B. Authorization — IDOR Defence (1 control)

#### B.5 — Tenant isolation

**Purpose.** Make sure every user can only read, edit, or delete their
own data. Closes the most common bug class on multi-tenant apps —
**Insecure Direct Object Reference** (OWASP A01) — where Bob types
Alice's note ID into the URL and sees Alice's data.

**How it works.** The user's identity is **always** derived from the JWT
— never from the request body, query string, or URL parameter. The
`@CurrentUser('id') userId: string` decorator pulls the ID out of
`request.user` (set by `AuthGuard` after JWT verification) and throws
401 if the guard didn't run. Every service-layer query then includes
`where: { id, userId }` — Prisma turns that into a SQL `WHERE` clause
that returns no row when the requested ID belongs to someone else. The
controller sees `null`, returns 404. The same rule applies to the
WebSocket gateway: `userOwnsJob()` checks ownership before joining a
job-progress room. There is no code path where a request body's
`userId` is trusted.

| Where | Threat |
|---|---|
| `backend/src/auth/decorators/current-user.decorator.ts`; `notes.service.ts`, `quizzes.service.ts`, `pdf.service.ts`; `websocket.gateway.ts:userOwnsJob` | IDOR — Bob reading Alice's notes by guessing the URL |

**Verify (2 min — live demo material).**
1. Log in as **Alice** (normal window). Create a note. Copy the URL — `/notes/cm123abc...`. Save the ID.
2. Open Incognito. Log in as **Bob**.
3. Paste Alice's note URL into Bob's address bar. Press Enter.
4. **Expected ✅:** Bob sees *"Note not found"* / 404. **Not** Alice's note.
5. Repeat with `/quizzes/<id>` and `/upload/<id>` — same 404.

---

### C. Input Validation (2 controls)

#### C.6 — Global ValidationPipe (whitelist + transform)

**Purpose.** Reject any request carrying fields the server doesn't
expect. Specifically blocks **mass assignment** — the attack where a
request body smuggles privileged fields like `"role": "ADMIN"` or
`"userId": "<victim>"` to escalate privilege or impersonate.

**How it works.** A single global `ValidationPipe` runs on every
incoming request. With `whitelist: true` it strips any property not
declared on the target DTO; with `forbidNonWhitelisted: true` it rejects
the request outright with 400 + a list of disallowed fields. The DTOs
themselves use `class-validator` decorators (`@IsString`, `@IsEmail`,
`@IsUUID`, `@MinLength`, `@MaxLength`, `@IsEnum`) so type, format, and
length are checked before the controller method runs. `transform: true`
auto-converts incoming JSON values to the declared TypeScript types so
downstream code can trust the shape. Combined with Prisma — which only
writes columns that exist on the model — even a field that slipped
through validation can't reach an unintended column.

| Where | Threat |
|---|---|
| `backend/src/main.ts`; `backend/src/**/dto/*.ts` | Mass-assignment via smuggled body fields; malformed input reaching business logic |

**Verify (1 min).**

DevTools Console (logged in):

```js
fetch('/notes', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': document.cookie.match(/csrf_token=([^;]+)/)[1],
  },
  body: JSON.stringify({
    title: 'x', content: 'y',
    role: 'ADMIN', userId: 'attacker', emailVerified: true,
  }),
}).then(r => r.json()).then(console.log)
```

**Expected ✅:** `400` response: `{ message: ["property role should not exist", "property userId should not exist", ...], statusCode: 400 }`. No DB row created.

---

#### C.7 — PDF upload triple check

**Purpose.** Make sure an uploaded file is actually a PDF, not malware
disguised as one. Three independent checks stack so each catches what
the others miss.

**How it works.** When a file arrives at `/upload`, `pdf.service.ts`
runs three sequential validations on the raw buffer.
**Layer 1 — MIME type:** `file.mimetype` must equal `application/pdf`;
catches lazy attackers who renamed a `.png` to `.pdf` (the browser
still sends `image/png`).
**Layer 2 — size cap:** `file.size > 10 MB` rejected; protects the disk
and the PDF parser from DoS.
**Layer 3 — magic bytes:** the first four bytes of `file.buffer` must
equal `%PDF` (`0x25 0x50 0x44 0x46`). This is the strongest layer: an
attacker can forge the MIME header, but they cannot lie about the
actual bytes of the file content.
Finally, the **filename is sanitised** through a whitelist regex
(`/[^a-zA-Z0-9.-]/g → _`), capped at 80 chars, and rejected outright if
it still contains `..`, `/`, or `\` — defence-in-depth against path
traversal.

| Where | Threat |
|---|---|
| `backend/src/uploads/pdf.service.ts:uploadPdf` | Malware disguised as PDF; oversize uploads; path-traversal filenames |

**Verify (3 min — strongest demo).**

```bash
# 1. Wrong MIME — image renamed .pdf
echo "PNG dummy" > evil.pdf
curl -i -X POST $API/upload \
  -H "X-CSRF-Token: $CSRF" -H "Cookie: $COOKIE" \
  -F "file=@evil.pdf;type=application/pdf"
```
**Expected ✅:** `400 "File content is not a valid PDF"` — magic-byte check catches it even though MIME header was forged.

```bash
# 2. Oversize
dd if=/dev/zero of=big.pdf bs=1M count=12 2>/dev/null
curl -i -X POST $API/upload \
  -H "X-CSRF-Token: $CSRF" -H "Cookie: $COOKIE" \
  -F "file=@big.pdf;type=application/pdf"
```
**Expected ✅:** `400 "File size exceeds 10MB limit"`.

```bash
# 3. Path traversal
curl -i -X POST $API/upload \
  -H "X-CSRF-Token: $CSRF" -H "Cookie: $COOKIE" \
  -F "file=@real.pdf;filename=../../etc/passwd.pdf;type=application/pdf"
```
**Expected ✅:** `400 "Invalid filename"`, OR upload succeeds with stored name sanitized to `etc_passwd.pdf` (no `../`).

---

### D. Output Hardening (1 control)

#### D.8 — Safe error responses

**Purpose.** Make sure server crashes and internal errors never leak
sensitive details (library versions, file paths, SQL fragments, schema
names) to the wire. Information disclosure is the reconnaissance step
of every targeted attack — taking it away forces attackers to test
blindly.

**How it works.** A global `AllExceptionsFilter` catches every uncaught
exception at the framework boundary. Known `HttpException`s (400, 404,
403, etc.) forward the status and a curated message — no stack trace.
**Anything else** (Prisma error, TypeError, runtime crash) collapses to
a generic `{ statusCode: 500, message: 'Internal server error', requestId: <uuid> }`
— the full stack lands only in server logs against that requestId, so
operators can still diagnose without leaking internals. The frontend
adds a second layer in `api.ts`: an Axios response interceptor inspects
the status code and replaces the body with generic
`{ message: 'Request failed' }` unless the status is in
`USER_SAFE_STATUSES = [400, 422, 429]` — those are safe to surface
verbatim because they're user-correctable validation / rate-limit
errors.

| Where | Threat |
|---|---|
| `backend/src/common/filters/all-exceptions.filter.ts`; `frontend/src/lib/api.ts` | Stack-trace reconnaissance — library versions, file paths, SQL fragments leaking |

**Verify (30 sec).**

DevTools Console:

```js
fetch('/notes/non-existent-id-12345', { credentials: 'include' })
  .then(r => r.json()).then(console.log)
```

**Expected ✅:** `{ statusCode: 404, message: "Note not found" }` or `{ statusCode: 500, message: "Internal server error", requestId: "<uuid>" }`. **No** stack trace, **no** file paths, **no** library names, **no** SQL fragments.

---

### E. Transport / Browser Hardening (1 control)

#### E.9 — Helmet security headers + strict CORS

**Purpose.** Hand the browser a clear set of rules so it refuses to do
the things browsers will otherwise do by default — embed the page in a
malicious frame, run inline scripts, fall back to HTTP, leak the URL
via `Referer`, share cookies with random origins. These headers cost
nothing at runtime and block whole classes of browser-side attacks.

**How it works.** Helmet middleware sets six headers on every response:
- **Content-Security-Policy** lists exactly which origins can serve
  scripts, styles, images, and outbound `fetch()` calls — anything else
  is blocked, neutering reflected and inline-script XSS.
- **Strict-Transport-Security** with 1-year `max-age` + `preload` tells
  browsers (and Chrome's preload list) that this site is HTTPS-only,
  preventing TLS-downgrade MITM.
- **frame-ancestors 'none'** prevents the page from being embedded in
  any `<iframe>`, killing clickjacking.
- **X-Content-Type-Options: nosniff** forbids the browser from
  second-guessing declared MIME types, defeating MIME-confusion attacks.
- **Referrer-Policy: strict-origin-when-cross-origin** strips path/query
  when a request crosses to another origin, so URL-embedded tokens don't
  leak via `Referer`.
- **Permissions-Policy** denies camera, microphone, geolocation, and
  payment APIs at the top frame.

CORS is pinned to the exact `FRONTEND_URL` (no wildcard), so cookies
(`credentials: true`) only travel to our own frontend, and a malicious
site can't make authenticated requests on the user's behalf.

| Where | Threat |
|---|---|
| `backend/src/main.ts` | XSS, clickjacking, MITM downgrade, cross-origin cookie theft |

**Verify — headers (1 min).**
1. Open any page on the site. DevTools → **Network** tab.
2. Click the document request → scroll to **Response Headers**.
3. **Expected ✅:** All five present:
   - `Content-Security-Policy: default-src 'self'; ...`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

**Verify — CORS (30 sec).**
1. Open `https://example.com`. DevTools → Console.
2. Run: `fetch('http://localhost:3000/auth/me', { credentials: 'include' }).then(r => console.log(r.status)).catch(e => console.log('blocked:', e.message))`
3. **Expected ✅:** Browser logs *"blocked: ... CORS policy ..."*. Request never reaches backend logs.

```js
// Excerpt: backend/src/main.ts
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", 'https://js.stripe.com'],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", FRONTEND_URL, 'https://api.stripe.com'],
      frameAncestors: ["'none'"],
      objectSrc:      ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
    },
  },
  hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
})
```

---

### F. Payments — Stripe Webhook Hardening (1 control)

#### F.10 — Webhook signature + idempotency

**Purpose.** Make sure subscription state in our database can only be
changed by genuine, fresh, single-delivery messages from Stripe. Closes
three real attacks at once: forged webhooks promoting attackers to PRO,
replayed week-old events, and Stripe's own duplicate retries
double-billing the user.

**How it works.** Three layers stack on every `/webhooks/stripe` POST.
**Layer 1 — signature verification:** `Stripe.webhooks.constructEvent()`
takes the raw request body, the `Stripe-Signature` header, and our
`STRIPE_WEBHOOK_SECRET`, recomputes the HMAC, and throws if it doesn't
match. The route is mounted with `raw({ type: 'application/json' })`
**before** the JSON parser in `main.ts` so the byte-for-byte payload is
preserved — JSON re-encoding would break the signature.
**Layer 2 — replay window:** the verified event's `event.created`
timestamp is compared to `Date.now()`; anything older than 5 minutes
plus 30 seconds of clock skew is rejected and audited as
`webhook_replay_rejected`.
**Layer 3 — idempotency:** the very first thing after signature passes
is `prisma.stripeEvent.create({ data: { id: event.id } })` — Stripe's
event ID is the primary key. A duplicate delivery hits the unique
constraint, the handler catches it and returns
`{ received: true, duplicate: true }` without touching subscription
state. The `User`-to-`Customer` mapping goes through our server-stored
`stripeCustomerId` only — the webhook payload's `client_reference_id`
is never trusted.

| Where | Threat |
|---|---|
| `backend/src/stripe/stripe.service.ts`; `backend/src/subscriptions/webhook.controller.ts`; `backend/src/main.ts` (raw-body mount) | Forged subscription events; Stripe-replay double-billing; customer-ID spoofing |

**Verify — forged signature (30 sec).**

```bash
curl -i -X POST $API/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"customer.subscription.created","data":{}}'
```
**Expected ✅:** `400 Bad Request` (signature verification failed). No subscription created.

**Verify — duplicate idempotency (needs Stripe CLI).**

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe   # tab 1
stripe trigger customer.subscription.created                # tab 2
stripe events resend <event-id>                              # re-send same event
```
**Expected ✅:** Second delivery returns `{ received: true, duplicate: true }`. DB has only ONE row in `StripeEvent`. Subscription unchanged from first run.

---

### CIA Triad — One Line Each

- **Confidentiality** — httpOnly cookie + IDOR-proof controllers +
  tenant-scoped Prisma queries + safe error responses (no stack leaks).
- **Integrity** — Stripe signature + idempotency + server-derived userId
  + Prisma parameterized writes + ValidationPipe whitelist.
- **Availability** — Redis throttling at every entry point + magic-byte
  check (defends PDF parser DoS) + global exception filter (no crash on
  unexpected error) + UsageGuard caps free-tier abuse.

### Defence-in-depth (in code, out of presentation scope)

For completeness — these ship with the project but are **not** part of
the critical-10 set above: audit logging (`AuditLog` table + `AuditAction`
enum), CSRF double-submit token (`csrf.middleware.ts`), OAuth state
(Supabase PKCE), WebSocket auth via cookie, full-logout cleanup,
COOP / CORP headers, file-storage backpressure, secret-rotation runbook
(`SECURITY.md`), CI dependency pinning, gitleaks + npm audit, dev-endpoint
prod-gating, fail-closed env validation, no-source-map check.

---

## Important Reminder Checklist

- [ ] Print copy of rubric.
- [ ] Capture UI screenshots into `docs/ui/` (notes-upload, quizzes, tutor,
  library, pricing, login).
- [ ] Submit PPT before presentation slot in Week 9.
- [ ] **Demo script:** signup → upload PDF → watch live progress → view
  note → generate quiz → ask tutor → upgrade via Stripe test card →
  log out.
- [ ] **Live security demo:** brute-force lockout countdown → cross-user
  IDOR (404) → `document.cookie` (no `access_token`) → curl forged
  Stripe webhook (400) → resend real Stripe event (`duplicate: true`).
- [ ] Have terminal ready for `curl -I` to show response headers.
