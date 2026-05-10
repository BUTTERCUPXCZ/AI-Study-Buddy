# Security Testing Guide — Critical Controls

A teammate-friendly, click-through companion to
`SECURITY_IMPLEMENTATION_AUDIT.md`. Same 10 controls, with simple steps
anyone can run from a browser. No code reading required.

> Total run time: ~20 minutes.
> Tools you'll need: a normal Chrome / Firefox window, an Incognito window,
> the browser DevTools panel (press **F12**), and one small dummy file
> (e.g. an image you'll rename to `.pdf`).

---

## Before you start

1. App running (frontend + backend).
2. DevTools open with the **Network** + **Application** tabs visible.
3. **Two test accounts.** If you don't have them yet:

   ```bash
   # account A — Alice
   TEST_USER_EMAIL=alice@test.com TEST_USER_PASSWORD='Pass!123' \
     npx ts-node backend/prisma/seed-test-user.ts

   # account B — Bob
   TEST_USER_EMAIL=bob@test.com TEST_USER_PASSWORD='Pass!123' \
     npx ts-node backend/prisma/seed-test-user.ts
   ```

For each test: ✅ = control working. ❌ = something is off — note it.

---

## 1. Passwords are hashed, not stored as text

**What it stops:** A database leak handing out plain passwords.

**Steps**
1. Register a new user via `/register`.
2. Open the database (Render dashboard → SQL editor, or `psql`).
3. Run: `SELECT email, password FROM "User" WHERE email = '<your-test-email>';`

**Expected ✅:** The `password` column is a long random-looking string starting
with `$2a$12$...` or `$2b$12$...`. **Not** the password you typed.

---

## 2. Login cookie is invisible to JavaScript

**What it stops:** A malicious script on the page stealing your login.

**Steps**
1. Log in normally.
2. DevTools → **Console** → type: `document.cookie` → Enter.

**Expected ✅:** The output **does not** contain `access_token`. (You'll see
`csrf_token` and maybe `sidebar_state` — those are intentional.)

In **Application → Cookies** confirm `access_token` row has **HttpOnly = ✓**
and **Secure = ✓** (Secure shows in production deployments).

---

## 3. Email verification gate

**What it stops:** Bots with throwaway emails using your AI quota.

**Steps**
1. Register a new user via `/register`. **Don't** confirm the email yet.
2. Try to log in with that account.
3. Check your inbox, click the **Confirm Email** link.
4. Try to log in again.

**Expected ✅:** Step 2 says "Please verify your email first." Step 4 succeeds.

---

## 4. Brute-force lockout

**What it stops:** Someone guessing your password by trying thousands of times.

**Steps**
1. On `/login`, type your real email + a wrong password. Submit.
2. Repeat 3 times in a row.
3. On attempt 4, type the **correct** password.

**Expected ✅:** Attempt 4 still fails with "Account temporarily locked. Try
again in 60 seconds." Wait 60 s, then login works.

---

## 5. You can't read someone else's data by guessing the URL (IDOR)

**What it stops:** Bob typing Alice's note ID into the URL and seeing her data.

**Steps**
1. Log in as **Alice** in your normal window. Create a note. Copy the URL —
   looks like `/notes/cm123abc...`. Save the ID.
2. Open Incognito. Log in as **Bob**.
3. Paste Alice's note URL into Bob's address bar. Press Enter.

**Expected ✅:** Bob sees a "Note not found" or 404 page. **Not** Alice's note.

Repeat with `/quizzes/<id>` — same behaviour.

---

## 6. Random extra fields get rejected

**What it stops:** Someone trying to make themselves an admin by smuggling
`"role": "ADMIN"` into a request body (mass-assignment).

**Steps**
1. Log in.
2. DevTools → **Console** → paste:
   ```js
   fetch('/notes', {
     method: 'POST',
     credentials: 'include',
     headers: {
       'Content-Type': 'application/json',
       'X-CSRF-Token': document.cookie.match(/csrf_token=([^;]+)/)[1]
     },
     body: JSON.stringify({
       title: 'test', content: 'hi',
       role: 'ADMIN', userId: 'attacker-id'
     })
   }).then(r => r.json()).then(console.log)
   ```

**Expected ✅:** Either a 400 error like *"property role should not exist"*,
or the note is saved and the database row has **no** `role` field set
(default `USER`).

---

## 7. Only real PDFs get uploaded

**What it stops:** Malware disguised as a PDF; oversize uploads;
path-traversal filenames.

**Steps**
1. Take any image file. Rename it to `fake.pdf`. Upload via the upload sheet.
2. Take a PDF over 10 MB (or any 12 MB file). Upload.
3. Take a real PDF, rename it to `../../sketchy.pdf`. Upload.

**Expected ✅:**
- Step 1 fails with "Invalid file type" / "File is not a PDF".
- Step 2 fails with a size limit message.
- Step 3 either fails, or succeeds but the stored filename has been
  cleaned to `sketchy.pdf` (no `../`).

---

## 8. Errors don't leak server details

**What it stops:** A stack trace telling an attacker which library version
to attack next.

**Steps**
1. DevTools → Console → paste:
   ```js
   fetch('/notes/non-existent-id-12345', { credentials: 'include' })
     .then(r => r.json()).then(console.log)
   ```

**Expected ✅:** Response is small JSON like
`{ statusCode: 404, message: 'Note not found' }`
or `{ statusCode: 500, message: 'Internal server error', requestId: '...' }`.
**No** file paths, **no** stack trace, **no** library names.

---

## 9. Security headers are set & CORS is strict

**What it stops:** XSS, clickjacking, MITM downgrade, cross-origin
cookie theft.

**Steps — headers:**
1. Open any page on the site. DevTools → **Network** tab.
2. Click the document request (the first row, usually your URL).
3. Scroll to **Response Headers**.

**Expected ✅:** All four are present:
- `Content-Security-Policy: default-src 'self'; ...`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`

**Steps — CORS:**
1. Open `https://example.com`.
2. DevTools → Console → paste:
   ```js
   fetch('http://localhost:3000/auth/me', { credentials: 'include' })
     .then(r => console.log('status', r.status))
     .catch(e => console.log('blocked:', e.message))
   ```

**Expected ✅:** Browser console shows a CORS error like *"Access blocked
by CORS policy"*. The request never reaches your server.

---

## 10. Stripe webhook can't be forged or replayed

**What it stops:** A fake `customer.subscription.created` upgrading an
attacker to PRO; Stripe retries double-granting credit.

**Steps — signature check (no Stripe CLI needed):**
1. Terminal:
   ```bash
   curl -X POST http://localhost:3000/webhooks/stripe \
     -H "Content-Type: application/json" \
     -d '{"type":"customer.subscription.created","data":{}}'
   ```

**Expected ✅:** Response is `400 Bad Request` (invalid signature). No
subscription is created.

**Steps — idempotency (needs Stripe CLI):**
```bash
stripe listen --forward-to localhost:3000/webhooks/stripe   # in tab 1
stripe trigger customer.subscription.created                # in tab 2
stripe events resend <event-id-from-first-call>             # re-deliver same event
```

**Expected ✅:** Second delivery returns `{ received: true, duplicate: true }`.
DB shows only ONE row in `StripeEvent`. Subscription state unchanged from
the first run.

---

## Quick checklist

Tick as you go:

- [ ] 1. Password hashed (bcrypt cost 12)
- [ ] 2. `access_token` not in `document.cookie`
- [ ] 3. Email verify gate blocks login pre-confirm
- [ ] 4. Account locks after 3 wrong logins
- [ ] 5. Cross-user note read returns 404
- [ ] 6. Extra fields rejected or stripped
- [ ] 7. Fake PDF / oversize / `..` filename rejected
- [ ] 8. 404 / 500 responses are generic
- [ ] 9. CSP, HSTS, nosniff, Referrer, Permissions headers present + cross-origin `fetch` blocked
- [ ] 10. Forged Stripe webhook returns 400; duplicate event returns `duplicate: true`

---

## If a test fails

1. Don't panic. Take a screenshot of what you saw.
2. Note which control number failed.
3. File an issue with: control number, the steps you ran, expected vs
   actual.
4. The audit doc (`SECURITY_IMPLEMENTATION_AUDIT.md`) has the file paths
   to point the fixer at the right place.

For questions, ping the team. Happy testing!
