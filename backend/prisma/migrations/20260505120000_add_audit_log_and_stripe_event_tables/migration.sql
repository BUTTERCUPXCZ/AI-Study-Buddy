-- S13 — restore the AuditLog + StripeEvent tables. The original migration
-- file was deleted from the repo by an accidental `git clean -fd`; the
-- Prisma schema still declares both models, so the schema and applied
-- migrations are out of sync. This migration brings them back into agreement
-- so a fresh deploy or `prisma migrate reset` recreates both tables.
--
-- Both tables carry security responsibility:
--   * AuditLog records security-sensitive actions (login, login_failed,
--     account_locked, file_delete, subscription_change, …) for forensic
--     review.
--   * StripeEvent enforces webhook idempotency by treating the Stripe-supplied
--     event id as a primary key — duplicate deliveries collide on the unique
--     constraint and are rejected before any side effect runs.

-- ----------------------------- AuditLog ------------------------------------

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog" ("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog" ("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog" ("createdAt");

-- ----------------------------- StripeEvent ---------------------------------

CREATE TABLE "StripeEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StripeEvent_type_idx" ON "StripeEvent" ("type");
