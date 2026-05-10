# Admin Dashboard — Implementation Plan

## Context

You want an admin dashboard for AI-Study-Buddy that surfaces:

1. **Users** — every account using the app, status, plan, last activity
2. **Server status** — backend health, queue depths, Redis, DB, recent errors
3. **Payments** — Stripe transactions, subscriptions, refunds
4. **Sales** — revenue, MRR, signup funnel, conversion to PRO
5. **Audit / activity** — security events, login failures, suspicious patterns

This document is the implementation roadmap. Approve it (or correct it)
before any code is written.

The intended outcome: a `/admin` section visible only to users whose
`role = ADMIN`, gated server-side, with read-only tables + simple
charts in P1; live updates + admin actions in P2-P3.

---

## Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| URL location | Path-based — `/admin/*` under main app | One SPA, one deploy, one cookie. Subdomain split would force splitting auth + CORS. |
| AuthN | Reuse existing AuthGuard (Supabase JWT cookie) | Admin users are users + a flag. No second auth system. |
| AuthZ | New `User.role` enum (USER, ADMIN) + `AdminGuard` (Nest) + frontend route gate | Standard role-based pattern. |
| Bootstrapping the first admin | SQL one-liner OR env-var allowlist `ADMIN_EMAILS=…` parsed at boot | No chicken-and-egg loop. |
| Charts | `recharts` (~80 KB, React-native, declarative) | Already lightweight for our scale; no canvas hand-rolling. |
| Tables | `@tanstack/react-table` (headless, types match TanStack Router we already use) | Sortable / filterable / paginated; styles via Tailwind. |
| Live data | Reuse existing Socket.IO `/jobs` namespace + new `/admin` namespace for queue/health pushes | Already have Redis adapter wiring (S E1). |
| Stripe data | Pulled live via `stripe.charges.list` etc. on demand, **not** mirrored to our DB | Stripe is the source of truth for payments. Cache 60 s in Redis to avoid rate-limits. |
| Server metrics | `prom-client` registry already exists (F6); admin endpoint scrapes + parses to JSON | One source of truth, no duplicate counters. |

---

## Data model changes

### `prisma/schema.prisma`

```prisma
enum UserRole {
  USER
  ADMIN
}

model User {
  // ...existing fields...
  role UserRole @default(USER)
  lastLoginAt DateTime?  // NEW — populated by AuditService.record on login
  @@index([role])
  @@index([lastLoginAt])
}
```

One additive migration:
`prisma/migrations/<ts>_add_user_role_and_last_login/migration.sql`.

`lastLoginAt` is touched in `AuditService.record` whenever the action
is `login` or `oauth_login`. Cheap, makes "active in last X days"
queries trivial.

---

## Backend — new module `backend/src/admin/`

```
admin/
├── admin.module.ts
├── guards/
│   └── admin.guard.ts          ← role check
├── users.controller.ts         ← GET /admin/users, GET /admin/users/:id
├── users.service.ts
├── metrics.controller.ts       ← GET /admin/metrics
├── metrics.service.ts          ← scrapes prom-client + queue counts
├── payments.controller.ts      ← GET /admin/payments
├── payments.service.ts         ← Stripe + 60s Redis cache
├── audit.controller.ts         ← GET /admin/audit (paginated)
└── overview.controller.ts      ← GET /admin/overview (top-level cards)
```

### Endpoints (P1)

| Method | Path | Returns |
|---|---|---|
| GET | `/admin/overview` | totals + 7d/30d activity counts + revenue total |
| GET | `/admin/users?cursor&limit&q&plan&role` | cursor-paginated user list with last-login, plan, attempts used |
| GET | `/admin/users/:id` | one user + their notes/quizzes/files counts |
| GET | `/admin/audit?cursor&limit&action&userId` | cursor-paginated audit log |
| GET | `/admin/metrics` | `{ http, queues, redis, db, memory, eventLoop }` snapshot |
| GET | `/admin/payments?cursor&limit&status` | recent Stripe charges (cached 60 s) |
| GET | `/admin/sales/timeseries?bucket=day&days=30` | `[{ date, signups, conversions, revenueCents }, …]` |

### `AdminGuard`

```ts
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ user?: { id: string } }>();
    if (!req.user) throw new UnauthorizedException();
    const u = await this.db.user.findUnique({
      where: { id: req.user.id },
      select: { role: true },
    });
    if (u?.role !== 'ADMIN') throw new ForbiddenException();
    return true;
  }
}
```

Applied with `@UseGuards(AuthGuard, EmailVerifiedGuard, AdminGuard)`
on every controller in the admin module.

### `MetricsService` snapshot

Pulls from existing facilities — no new instrumentation:
- BullMQ queue counts: `queue.getJobCounts('waiting','active','completed','failed','delayed')` for each registered queue.
- Redis: `RedisService.ping()` → ms.
- Postgres: `db.$queryRaw\`SELECT 1\`` → ms.
- Process: `process.memoryUsage()`, `process.uptime()`, `process.cpuUsage()`.
- Event-loop lag: `perf_hooks.monitorEventLoopDelay`.
- HTTP histogram: parse `metrics.serialize()` from F6 to get p50/p95/p99 over the last hour. (Optional in P1; serve raw `/metrics` text in P1.)

### `PaymentsService` Stripe calls

- `stripe.charges.list({ limit })` for recent charges.
- `stripe.subscriptions.list()` for active subscriptions count.
- `stripe.customers.list()` for total customers.
- Cache the response in Redis under `admin:stripe:<endpoint>:<hash>` for 60 s.
- Map each charge to `{ id, amountCents, currency, customerEmail, createdAt, status }` so we don't ship raw Stripe objects to the browser.

### Bootstrap

Two complementary mechanisms:

1. **Env allowlist.** New `ADMIN_EMAILS=a@x.com,b@x.com` env var. On
   first authenticated request, `AdminGuard` checks the user's email
   against the list and **promotes** the row to `role=ADMIN` if it
   matches. One-time, idempotent. Saves you from running SQL.
2. **Manual SQL.** `UPDATE "User" SET role='ADMIN' WHERE email='you@x.com';`
   for break-glass.

Validate `ADMIN_EMAILS` in `validate-env.ts` (S6) — must be comma-list
of valid emails.

---

## Frontend — new section `frontend/src/routes/__admin.*`

```
routes/
├── __admin.tsx              ← layout + AdminGuard + redirect on non-admin
├── __admin.index.tsx        ← overview (cards + 30d revenue chart)
├── __admin.users.tsx        ← users table
├── __admin.users.$userId.tsx← user detail
├── __admin.payments.tsx     ← payments table + revenue chart
├── __admin.sales.tsx        ← signup/conversion funnel + MRR
├── __admin.server.tsx       ← server status (live)
└── __admin.audit.tsx        ← audit log viewer
```

`__admin.tsx` mirrors `__protected.tsx` but adds a role check in
`beforeLoad`:

```tsx
beforeLoad: async ({ location }) => {
  // Inherits the auth check from __protected via TanStack Router's
  // route hierarchy (__admin sits inside __protected's parent? — see
  // note below) OR re-uses authService.getCurrentUser().
  const user = await authService.getCurrentUser()
  if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
  if ((user as { role?: string }).role !== 'ADMIN') {
    throw redirect({ to: '/library' })
  }
  return { user }
}
```

(File-tree note: TanStack Router file-based routing flattens `__admin`
as a sibling of `__protected`, not a child. Either repeat the auth
check, or set `__admin` to live as a nested route under `__protected`
by using a `_protected/admin/...` path. P1 picks the simpler "repeat
the check" approach.)

### Components

```
components/admin/
├── AdminLayout.tsx          ← sidebar with Overview / Users / Payments / Sales / Server / Audit
├── StatCard.tsx             ← icon + label + big number + delta
├── RevenueChart.tsx         ← recharts area chart
├── SignupFunnelChart.tsx
├── DataTable.tsx            ← @tanstack/react-table wrapper (sort, paginate, search)
├── UserRow.tsx
├── PaymentRow.tsx
├── AuditRow.tsx
└── HealthIndicator.tsx      ← green/amber/red dot + label
```

### Hooks / services

```
services/AdminService.ts     ← getOverview, listUsers, getUser, listPayments, getMetrics, listAudit
hooks/useAdmin.ts            ← React-Query wrappers around AdminService
```

`useAdmin.ts` uses the same staleTime/gcTime defaults as the rest of
the app. The server-status query refetches every 5 s (admin actively
watches it).

---

## P1 deliverable (MVP, ~1 day)

Goal: admin can log in, see at-a-glance health, browse users, browse audit.

- [ ] Prisma migration: `role` + `lastLoginAt` + indexes.
- [ ] `AdminGuard` with env-allowlist promotion.
- [ ] Update `AuditService.record('login'|'oauth_login')` to also touch `lastLoginAt`.
- [ ] `/admin/overview` (totals: users, PRO, signups today, revenue total).
- [ ] `/admin/users` — paginated list, sortable by createdAt / lastLoginAt / plan.
- [ ] `/admin/users/:id` — single-user detail.
- [ ] `/admin/audit` — paginated audit log; filter by action.
- [ ] `/admin/metrics` — JSON snapshot (queue depths, redis ms, db ms, memory).
- [ ] Frontend `__admin.tsx` + `__admin.index.tsx` + `__admin.users.tsx` + `__admin.audit.tsx` + `__admin.server.tsx`.
- [ ] AdminLayout sidebar.
- [ ] Bootstrap: `ADMIN_EMAILS` env var + docs entry.

## P2 (~1 day)

Goal: payments + sales + server polish.

- [ ] `PaymentsService` with Stripe live + 60-s Redis cache.
- [ ] `/admin/payments` route + table.
- [ ] `/admin/sales/timeseries` — daily aggregates.
- [ ] `/admin/sales` route — revenue chart, signup chart, FREE→PRO conversion.
- [ ] HTTP latency histograms in `/admin/metrics`.
- [ ] Auto-refresh on `/admin/server` (5-second interval).

## P3 (~half day)

Goal: live updates and admin actions (with confirmation modals).

- [ ] Socket.IO `/admin` namespace pushing queue / metric deltas every 2 s — replaces polling on `/admin/server`.
- [ ] Admin actions: ban user (sets `disabled=true`), force-verify email, force-logout (delete sessions + invalidate `auth:token:*`).
- [ ] Redis lockout reset button (clears `auth:fail:email:*` for a chosen email).

---

## Critical files (recap)

```
NEW   backend/src/admin/admin.module.ts
NEW   backend/src/admin/guards/admin.guard.ts
NEW   backend/src/admin/users.controller.ts
NEW   backend/src/admin/users.service.ts
NEW   backend/src/admin/metrics.controller.ts
NEW   backend/src/admin/metrics.service.ts
NEW   backend/src/admin/payments.controller.ts        (P2)
NEW   backend/src/admin/payments.service.ts            (P2)
NEW   backend/src/admin/audit.controller.ts
NEW   backend/src/admin/overview.controller.ts
NEW   backend/prisma/migrations/<ts>_add_user_role_and_last_login/migration.sql
EDIT  backend/prisma/schema.prisma                    + role + lastLoginAt
EDIT  backend/src/app.module.ts                       import AdminModule
EDIT  backend/src/auth/auth.service.ts                bump lastLoginAt on login + oauth login
EDIT  backend/src/common/services/audit.service.ts    expose 'admin_*' actions in AuditAction enum
EDIT  backend/src/config/validate-env.ts              parse ADMIN_EMAILS
EDIT  backend/.env.example                            document ADMIN_EMAILS

NEW   frontend/src/routes/__admin.tsx
NEW   frontend/src/routes/__admin.index.tsx
NEW   frontend/src/routes/__admin.users.tsx
NEW   frontend/src/routes/__admin.users.$userId.tsx
NEW   frontend/src/routes/__admin.payments.tsx        (P2)
NEW   frontend/src/routes/__admin.sales.tsx           (P2)
NEW   frontend/src/routes/__admin.server.tsx
NEW   frontend/src/routes/__admin.audit.tsx
NEW   frontend/src/components/admin/AdminLayout.tsx
NEW   frontend/src/components/admin/StatCard.tsx
NEW   frontend/src/components/admin/DataTable.tsx
NEW   frontend/src/components/admin/RevenueChart.tsx  (P2)
NEW   frontend/src/components/admin/HealthIndicator.tsx
NEW   frontend/src/services/AdminService.ts
NEW   frontend/src/hooks/useAdmin.ts
EDIT  frontend/src/components/app-layout.tsx          show "Admin" link only if role==='ADMIN'
EDIT  frontend/src/services/AuthService.ts            getCurrentUser must surface role
```

Existing utilities to reuse:
- `RedisService` — `ping`, `get`, `set` for the 60 s Stripe cache (`backend/src/redis/redis.service.ts`).
- `prom-client` registry — `MetricsService.serialize()` (`backend/src/observability/metrics.service.ts`).
- BullMQ queues already injected in JobsModule; `MetricsService` calls `queue.getJobCounts(...)`.
- Existing `EmailVerifiedGuard`, `RedisThrottlerGuard`, `IdempotencyInterceptor` — applied to admin routes for consistency.
- Existing AuditService — for any admin action (`admin_user_disabled`, `admin_lockout_reset`, etc.).
- `<Skeleton />` primitive (`frontend/src/components/ui/skeleton.tsx`) for table-loading shells.
- Existing `safeRedirect` (`frontend/src/lib/safeRedirect.ts`) — extend whitelist to include `/admin`-prefixed paths.

New deps required:
- backend: none (Stripe SDK already present).
- frontend: `recharts`, `@tanstack/react-table` (verify if already in `package.json`; both are tree-shakeable).

---

## Security considerations

1. **Server-side check is the gate.** `AdminGuard` is the source of
   truth. The frontend role check is UX only — never trust the
   browser.
2. **Audit every admin action.** Each mutation in P3 fires an
   AuditLog row with `userId = adminId`, `target = userId-acted-on`,
   `meta = { reason }`.
3. **Rate-limit admin endpoints.** Reuse `@Throttle(30, 60)` on
   read-only admin endpoints; `@Throttle(10, 60)` on mutating ones.
4. **Don't leak Stripe internals.** `PaymentsService` returns a
   shaped DTO, not the raw Stripe object — keeps card-fingerprints,
   PII, and partial data out of the browser.
5. **Admin promotion via email allowlist** — only whitelisted emails
   ever auto-promote. Adding to the list is an env-var change, which
   forces a deploy review.
6. **CSP unchanged.** Admin charts pull no third-party JS; recharts
   ships pure JS.
7. **CSRF unchanged.** Admin mutations follow the same X-CSRF-Token
   header rule as the rest of the app.

---

## Verification

End-to-end check after P1:

1. Set `ADMIN_EMAILS=you@x.com` in `backend/.env`. Restart backend.
2. Sign in as `you@x.com`. Open `/admin` → cards render, /admin/users
   shows the seeded users, /admin/audit shows recent rows.
3. Sign in as a non-admin user → `/admin` redirects to `/library`.
4. `curl -i $API/admin/users` without a cookie → 401.
5. `curl -i -b cookieNonAdmin.txt $API/admin/users` → 403.
6. `cd backend && npm test` — 35/35 still pass plus a new spec for
   `AdminGuard`.
7. `cd backend && npx tsc --noEmit` — clean.
8. `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — clean.

---

## Open questions

Reply with answers (or "decide for me") before I touch code:

| # | Question | Default if unanswered |
|---|---|---|
| Q1 | Bootstrap mechanism — env allowlist, manual SQL, or both? | **both** (safest) |
| Q2 | Should the admin section be at `/admin/*` (path) or `admin.budsai.vercel.app` (subdomain)? | **path** (one deploy) |
| Q3 | Live updates in P3 via WebSocket — must-have or nice-to-have? | **nice-to-have**; P3 polish only |
| Q4 | Stripe data: live API every load, or daily cron mirroring into a `Sale` table? | **live + 60 s cache** |
| Q5 | Charts library — `recharts` (smaller, simpler) or `chart.js` (more chart types)? | **recharts** |
| Q6 | Want me to wire RBAC for finer-grained roles (SUPER_ADMIN vs SUPPORT) now or YAGNI? | **YAGNI** — single ADMIN role |
| Q7 | Multi-tenant in scope? (e.g. school accounts) | **no** — single tenant |
| Q8 | Rough timeline you want? | **P1 + P2 in 2 days** |
