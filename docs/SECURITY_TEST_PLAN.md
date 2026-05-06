# Security Test Plan — Step-by-Step

Each section = one security feature. Run the steps top-to-bottom. If the
result matches "Expected", that feature passes.

## Setup (do this once)

Open a terminal in the repo root.

```bash
export API="http://localhost:3000"
export FRONTEND="http://localhost:5173"
```

Start backend + frontend:

```bash
# terminal 1
cd backend && npm run start:dev

# terminal 2
cd frontend && npm run dev
```

Tools you'll need: `curl`, `psql` (Supabase Studio works), `redis-cli`,
browser DevTools (Network + Application + Console tabs). For Stripe
tests: `stripe-cli` logged in to your project.

---

# Authentication

## A1 — bcrypt cost 12

1. Register a new account in the UI (or via curl).
2. Open Supabase Studio → Table Editor → `User` → find that row → copy
   the `password` value.
3. Look at the prefix.

**Expected:** starts with `$2b$12$`. The `12` is the cost factor.

## A2 — Auth cookie is httpOnly + Secure

1. Log in via the UI.
2. Open DevTools → **Application** → **Cookies** → click your origin.
3. Find the `access_token` row.

**Expected:** `HttpOnly` is checked. In production also `Secure` and
`SameSite=None`. In dev, `SameSite=Lax`.

4. In DevTools **Console**, type `document.cookie`.

**Expected:** the output does NOT contain `access_token`. Means JS can't
steal it.

## A3 — Email verification gate

1. Register a fresh email. Do NOT click the verify link.
2. Confirm the user is in DB but unverified:
   ```sql
   SELECT email, "emailVerified" FROM "User" WHERE email='<your-test>';
   ```
   `emailVerified` should be `false`.
3. Log in (the login itself surfaces a "Email not verified" message).
4. Try to use a protected endpoint anyway. From the browser console:
   ```js
   fetch('/notes', { credentials: 'include' }).then(r => console.log(r.status))
   ```

**Expected:** 403 with `Email not verified...`. Click the verify link →
re-test → 200.

## A4 — OAuth state nonce

1. Click **Continue with Google** on `/login`.
2. **Before** completing the Google form: DevTools → Application →
   Session Storage → confirm `oauth_state` exists (a UUID).
3. Complete Google login → land on `/supabaseCallback` → page redirects.
4. Re-check session storage.

**Expected:** `oauth_state` is gone (cleared on success).

5. In a new tab paste `http://localhost:5173/supabaseCallback?state=fake&code=fake` → enter.

**Expected:** "Authentication Error" → bounces back to `/login`. Replay
fails because no stored nonce matches.

## A5 — Per-route rate limit (login + register)

```bash
for i in 1 2 3 4; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST $API/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"nope@x.com","password":"wrong"}'
done
```

**Expected:** `400 400 400 429`. The 4th call's body has `retryAfter: 60`.

Same test against `/auth/register`:
```bash
for i in 1 2 3 4; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST $API/auth/register -H 'Content-Type: application/json' \
    -d '{"email":"x'$i'@x.com","password":"abc12345","Fullname":"x"}'
done
```

**Expected:** 4th call returns 429.

## A6 — Account lockout (S1, 3 wrong attempts → 60 s lock)

1. Pick a real account email `EMAIL`.
2. Hammer login with wrong password 3× (rotate IPs if you have them):
   ```bash
   for i in 1 2 3; do
     curl -X POST $API/auth/login -H 'Content-Type: application/json' \
       -d "{\"email\":\"$EMAIL\",\"password\":\"wrong\"}"; echo
   done
   ```
3. Try a 4th wrong attempt.

**Expected:** 4th call returns 429 with
`{"message":"Account temporarily locked...","retryAfter":60}`.

4. Confirm audit row:
   ```sql
   SELECT * FROM "AuditLog"
   WHERE action='account_locked'
   ORDER BY "createdAt" DESC LIMIT 1;
   ```

**Expected:** one row with `target = EMAIL`.

5. To unlock immediately for retry:
   ```bash
   redis-cli --scan --pattern 'auth:fail:email:*' | xargs redis-cli DEL
   ```

## A7 — WebSocket rejects unauthenticated connect

Open browser DevTools console while LOGGED OUT:

```js
const s = io('http://localhost:3000/jobs');
s.on('connect_error', e => console.log('WS rejected:', e.message));
```

**Expected:** `WS rejected: Authentication required` (or similar). No
`connect` event fires. Now log in and re-run → `connect` succeeds.

## A8 — Logout clears all sessions

1. Log in.
2. DevTools → Application → confirm three places have data:
   - Cookies → `access_token` present
   - Session Storage → may have `oauth_state` etc.
   - Local Storage → `supabase-auth` present
3. Click **Logout**.
4. Re-inspect all three.

**Expected:** all three cleared.

5. From DevTools console:
   ```js
   fetch('/auth/me', { credentials: 'include' }).then(r => console.log(r.status))
   ```

**Expected:** 401.

---

# Authorization (IDOR protection)

## B1 — Cannot spoof `userId` in request body

1. Log in as user A. Save cookies via the browser, OR using curl:
   ```bash
   curl -c cookieA.txt -X POST $API/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"alice@x.com","password":"correctA"}'
   ```
2. Try to plant a note with someone else's `userId` in the body:
   ```bash
   curl -b cookieA.txt -X POST $API/notes \
     -H 'Content-Type: application/json' \
     -d '{"title":"x","content":"y","userId":"<USER_B_ID>"}'
   ```

**Expected:** 400 `property userId should not exist` (ValidationPipe
strips it). Even if it didn't, the controller takes userId from the
JWT, not body.

## B2 — Cannot read / delete another user's resources

1. Log in as user B in another browser. Create a note. Note its `id`.
2. As user A, hit user B's note:
   ```bash
   curl -b cookieA.txt -i $API/notes/<USER_B_NOTE_ID>
   curl -b cookieA.txt -i -X DELETE $API/notes/<USER_B_NOTE_ID>
   ```

**Expected:** both return 403 or 404. User B's note still exists.

3. Repeat for `/quizzes/<id>`, `/upload/<id>`, `/jobs/<id>`.

## B3 — WebSocket rooms are user-scoped

1. Open two browsers — user A logged in browser 1, user B in browser 2.
2. Browser 1 console:
   ```js
   const s = io('http://localhost:3000/jobs', { transports: ['websocket'] });
   s.onAny((event, payload) => console.log('A saw', event, payload));
   ```
3. Browser 2 console: same listener.
4. Trigger a PDF upload in browser 1 (user A).

**Expected:** browser 1 sees `job:progress` events. Browser 2 sees nothing.

---

# Input validation

## C1 — ValidationPipe rejects unknown fields

```bash
curl -b cookieA.txt -X POST $API/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"x","content":"y","isAdmin":true}'
```

**Expected:** 400 with `property isAdmin should not exist`.

## C2 — DTO format validation

```bash
curl -X POST $API/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"not-an-email","password":"x","Fullname":""}'
```

**Expected:** 400 with class-validator messages for each bad field.

## C3 — File upload — wrong MIME / wrong magic bytes / oversized

```bash
# 1. Wrong MIME (image with .pdf extension faked)
curl -b cookieA.txt -X POST $API/upload \
  -F "file=@photo.jpg;type=application/pdf" -F "fileName=evil.pdf"

# 2. Right MIME, wrong magic bytes
echo 'not actually a pdf' > fake.pdf
curl -b cookieA.txt -X POST $API/upload \
  -F "file=@fake.pdf;type=application/pdf" -F "fileName=fake.pdf"

# 3. Oversized
dd if=/dev/zero of=big.pdf bs=1M count=11
curl -b cookieA.txt -X POST $API/upload \
  -F "file=@big.pdf;type=application/pdf" -F "fileName=big.pdf"
```

**Expected:**
1. 400 (MIME or magic-byte check)
2. 400 `File content is not a valid PDF`
3. 400 `File size exceeds 10MB limit`

Then check Supabase Storage — none of those files are present.

## C4 — Filename path traversal blocked

```bash
curl -b cookieA.txt -X POST $API/upload \
  -F "file=@valid.pdf;type=application/pdf" \
  -F "fileName=../../etc/passwd.pdf"
```

**Expected:** Either rejected with `Invalid filename`, OR stored at
`<userId>/<ts>-_._.._etcpasswd.pdf` — never escapes the user folder.
Inspect in Supabase Storage to confirm.

## C5 — No raw SQL anywhere

```bash
grep -rn '\$queryRawUnsafe\|\$executeRawUnsafe' backend/src
```

**Expected:** no output (zero hits).

---

# Output & error handling

## D1 — Generic 500 with requestId

1. Trigger any backend error (the simplest is to stop the DB and call
   any endpoint, OR temporarily plant `throw new Error('boom')` in a
   controller).
2. Read the response body and the server logs.

**Expected:**
- Response: `{"statusCode":500,"message":"Internal server error","requestId":"<uuid>"}`
- Server log: full stack trace tagged with the same `requestId`.

No stack in the HTTP response.

## D2 — Frontend filters non-allowlisted error messages

1. Open DevTools → Network tab in the running app.
2. Trigger any 5xx (turn off backend mid-request).
3. Look at how the error is rendered in the UI.

**Expected:** UI shows `Something went wrong. Please try again.`, NOT
the raw backend message. (Allowlisted statuses: 400, 422, 429, 401 —
their messages pass through.)

## D3 — Audit-log redacts secret-shaped fields

1. In a Node REPL inside `backend/`:
   ```ts
   import { AuditService } from './src/common/services/audit.service';
   // construct one with a Prisma stub or just log the redactor output
   ```
   Or simpler — call any auth endpoint and pass `password` in a stray
   meta call from a temporary test.
2. Query:
   ```sql
   SELECT meta FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 1;
   ```

**Expected:** any key matching `password|token|secret|...` shows
`"[REDACTED]"`. Non-sensitive keys (e.g. `email`) preserved.

## D4 — OAuth callback strips token from URL

1. Sign in with Google. Wait for the redirect.
2. Look at the URL bar on `/supabaseCallback` BEFORE it navigates away.
3. Open browser **History** and find the `/supabaseCallback` entry.

**Expected:** Both show clean URL — no `access_token`, `refresh_token`,
or `state` params/hash. They were stripped by `history.replaceState`.

## D5 — No production source maps

```bash
cd frontend && npm run build && find dist -name '*.map'
```

**Expected:** empty output. CI also enforces this.

---

# Transport & headers

## E1 — Helmet sets all required headers

```bash
curl -I $API/health/live
```

**Expected — every one of these present in the response:**
- `Content-Security-Policy: default-src 'self'; ...; frame-ancestors 'none'; ...`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), ...`

External score check: paste the deployed origin into
`https://securityheaders.com` — expect grade A or above.

## E2 — CORS bound to FRONTEND_URL only

```bash
curl -i -H "Origin: https://attacker.com" \
  -X OPTIONS $API/notes \
  -H "Access-Control-Request-Method: POST"
```

**Expected:** No `Access-Control-Allow-Origin` value matching
`attacker.com` is returned. Browser fetch from `attacker.com` would be
blocked by the preflight.

---

# Payments (Stripe)

## F1 — Webhook signature verification

```bash
curl -i -X POST $API/webhooks/stripe \
  -H 'Content-Type: application/json' \
  -H 'Stripe-Signature: t=1,v1=fake' \
  --data '{"id":"evt_fake","type":"customer.subscription.created"}'
```

**Expected:** 400 `Webhook Error: ...`. `SELECT * FROM "StripeEvent"`
shows no row with that id.

## F2 — Webhook idempotency

```bash
stripe trigger checkout.session.completed       # creates evt_X
stripe events resend evt_X                       # resend same id
```

**Expected:** First call: `{ received: true }`. Second:
`{ received: true, duplicate: true }`. SQL: exactly one row in
`StripeEvent` with that `id`. User row updated only once.

## F3 — Webhook replay window (events older than 5 min rejected)

```bash
stripe trigger checkout.session.completed \
  --override-event-created=$(($(date +%s) - 600))    # backdated 10 min
```

**Expected:** 400 `Webhook too old`. Audit row with
`action='webhook_replay_rejected'`.

## F4 — Trusted customer ID mapping

1. Open `backend/src/subscriptions/webhook.controller.ts`.
2. Confirm every state-change query uses
   `where: { stripeCustomerId: <from-stripe-event> }` — never reads a
   user id out of request body / metadata.

**Expected:** Code review confirms, plus a probe:
- Trigger `customer.subscription.created` for customer X
- Confirm the only User row touched in DB is the one whose
  `stripeCustomerId = X`

---

# Audit & monitoring

## G1 — Audit log captures user / IP / UA / action

1. Trigger one each of: login, logout, register, oauth login, file
   upload, file delete, subscription change.
2. SQL:
   ```sql
   SELECT action, "userId", ip, "userAgent", meta, "createdAt"
   FROM "AuditLog"
   ORDER BY "createdAt" DESC LIMIT 20;
   ```

**Expected:** Each event present with non-null `ip`, `userAgent`,
`userId`. `meta` contains no secrets.

## G2 — Failed-login tracking

1. Run TC-A6 (3 wrong logins).
2. SQL:
   ```sql
   SELECT action, target, meta FROM "AuditLog"
   WHERE action IN ('login_failed','account_locked')
   ORDER BY "createdAt" DESC LIMIT 5;
   ```

**Expected:** 3× `login_failed` rows + 1× `account_locked` row, all
with the same `target` email.

## G3 — Action enum prevents log injection

1. Try to add this to any test file in `backend/`:
   ```ts
   auditService.record({ action: 'login\nFAKE: admin', request });
   ```
2. Run `npx tsc --noEmit`.

**Expected:** TypeScript compile error:
`Type '"login\\nFAKE: admin"' is not assignable to type 'AuditAction'`.

---

# Operational

## H1 — Fail-closed on missing env var

```bash
cd backend
NODE_ENV=production STRIPE_WEBHOOK_SECRET= node dist/main 2>&1 | head -5
```

**Expected:** Process exits with non-zero code. Log says
`Invalid environment configuration: ... STRIPE_WEBHOOK_SECRET ...`.

## H2 — Dev endpoints disabled in prod

```bash
NODE_ENV=production curl -i $API/redis/ping
```

**Expected:** 404 `Cannot GET /redis/ping`. The dev controller is only
mounted when `NODE_ENV !== 'production'`.

## H3 — `.gitignore` blocks `.env` and key files

```bash
echo "FAKE=secret" > backend/.env.test
echo "test" > somekey.pem
git status
```

**Expected:** Neither file appears in `git status` (already ignored).

```bash
git ls-files | grep -E '\.env$|\.pem$|\.key$|\.zip$'
```

**Expected:** empty output.

## H4 — CI gates merges on vulnerable deps

1. On a throwaway branch:
   ```bash
   cd backend && npm install lodash@4.17.10
   git commit -am 'test: vuln dep'
   git push origin <branch>
   ```
2. Open a PR.

**Expected:** CI's `npm audit (high+)` step fails. PR cannot merge
until the dep is removed.

## H5 — CI gates merges on committed secrets

1. On a throwaway branch, add a fake AWS-shaped key:
   ```bash
   echo 'AKIA1234567890ABCDEF' > test.fixture
   git add test.fixture && git commit -m 'test'
   git push origin <branch>
   ```
2. Open a PR.

**Expected:** CI's `Secrets scan (gitleaks)` job fails. Merge blocked.

## H6 — CI Actions pinned to commit SHAs

```bash
grep -E 'uses:\s*[a-z0-9./_-]+@[0-9a-f]{40}' .github/workflows/ci.yml
```

**Expected:** every `uses:` line lists a 40-character SHA. No `@v1`,
`@v4`, `@main`, etc.

## H7 — Secret rotation runbook present

1. Open `SECURITY.md`.
2. Look for the **Operator runbook** entries under each control.

**Expected:** every section documents how to rotate / clear that
control's state — bcrypt cost change, Redis lockout reset, Stripe key
roll, Supabase service-role roll, Upstash password reset, Postgres
password reset.

---

# Quick sweep — run before every prod deploy

If short on time, hit these 8 in order; each takes ~1-2 min:

1. **A6** — 3 wrong logins → 4th gives 429 + AuditLog row
2. **A3** — unverified user → upload returns 403
3. **B2** — user A reads user B's note → 403 / 404
4. **C1** — POST with extra `isAdmin:true` → 400
5. **D5** — `find frontend/dist -name '*.map'` → empty
6. **E1** — `curl -I $API/health/live` → all 7 headers present
7. **F1** — fake-signed Stripe webhook → 400
8. **H6** — `grep` confirms CI Actions are SHA-pinned

All 8 PASS = ship it.
