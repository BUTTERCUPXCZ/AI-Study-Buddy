import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';

/**
 * S7 — closed enum of audit actions. Constraining the set means a future
 * caller cannot inject log-poisoning sequences (newlines, fake entries) by
 * passing arbitrary strings. New actions go here intentionally.
 */
export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'account_locked'
  | 'account_unlocked'
  | 'logout'
  | 'register'
  | 'oauth_login'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'email_verified'
  | 'email_verify_failed'
  | 'file_upload'
  | 'file_delete'
  | 'note_create'
  | 'note_delete'
  | 'quiz_create'
  | 'quiz_delete'
  | 'subscription_change'
  | 'subscription_created'
  | 'subscription_checkout_completed'
  | 'subscription_cancelled'
  | 'webhook_received'
  | 'webhook_replay_rejected'
  | 'csrf_violation'
  | 'rate_limit_exceeded'
  | 'admin_user_promoted'
  | 'admin_user_demoted'
  | 'admin_user_banned'
  | 'admin_user_unbanned'
  | 'admin_lockout_cleared'
  | 'admin_payment_refunded';

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  target?: string;
  request?: Request;
  meta?: Record<string, unknown>;
}

// S7 — keys that should never be persisted in the audit meta blob. Match
// is case-insensitive substring; both `password` and `userPassword` redact.
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|api[_-]?key|client[_-]?secret/i;
const REDACTED = '[REDACTED]';
const MAX_STRING_LEN = 1000;
const MAX_META_BYTES = 4 * 1024;

/**
 * Recursively walk an object and redact any value whose key matches the
 * sensitive pattern; truncate string values longer than 1 KB. Does not
 * mutate the input — produces a new structure so the caller's object is
 * left untouched if it's used elsewhere.
 */
function redactMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const visit = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return value.length > MAX_STRING_LEN
        ? value.slice(0, MAX_STRING_LEN) + '…[truncated]'
        : value;
    }
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (SENSITIVE_KEY_PATTERN.test(k)) {
          out[k] = REDACTED;
        } else {
          out[k] = visit(v);
        }
      }
      return out;
    }
    return value;
  };
  return visit(meta) as Record<string, unknown>;
}

/**
 * Records security-sensitive actions to the AuditLog table. Failures are
 * swallowed (logged only) so a missing audit row never blocks the user
 * action — but every call site should still pass through here.
 *
 * S7 protections applied here:
 *   - `action` is a closed union, so log-injection via newline-stuffed
 *     action strings is impossible at compile time.
 *   - `meta` keys matching SENSITIVE_KEY_PATTERN are replaced with
 *     `[REDACTED]` even if a future caller carelessly passes a token.
 *   - `meta` strings longer than 1 KB are truncated; total serialized meta
 *     larger than 4 KB is replaced with a marker so a single audit row
 *     never bloats the table.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  record(entry: AuditEntry): void {
    const ip = entry.request?.ip;
    const ua = entry.request?.headers?.['user-agent'];
    const userAgent = typeof ua === 'string' ? ua.slice(0, 500) : undefined;

    // Bump lastLoginAt on successful auth flows. Best-effort — failures
    // shouldn't block the audit insert.
    if (
      entry.userId &&
      (entry.action === 'login' || entry.action === 'oauth_login')
    ) {
      this.databaseService.user
        .update({
          where: { id: entry.userId },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => undefined);
    }

    let meta: Record<string, unknown> | undefined;
    if (entry.meta) {
      const redacted = redactMeta(entry.meta);
      const serialized = JSON.stringify(redacted);
      meta =
        serialized.length > MAX_META_BYTES
          ? { truncated: true, originalSize: serialized.length }
          : redacted;
    }

    this.databaseService.auditLog
      .create({
        data: {
          userId: entry.userId ?? null,
          action: entry.action,
          target: entry.target,
          ip,
          userAgent,
          meta: meta as object | undefined,
        },
      })
      .catch((err: unknown) => {
        this.logger.warn(
          `Audit write failed for action=${entry.action}: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      });
  }
}
