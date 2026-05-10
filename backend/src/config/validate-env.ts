import { z } from 'zod';
import { Logger } from '@nestjs/common';

/**
 * Strict env-var validation. Runs once before NestFactory.create. Missing or
 * malformed vars exit the process with a clear error rather than booting a
 * degraded service that silently skips security checks (e.g. a Stripe webhook
 * with no STRIPE_WEBHOOK_SECRET no-ops signature verification).
 *
 * In development, missing optional vars only log a warning so contributors
 * can iterate on subsystems individually. In production every required key
 * is mandatory.
 */
const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.string().regex(/^\d+$/).optional(),

    // Database (required everywhere — app cannot start without Prisma).
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),

    // Frontend origin used for CORS, CSP connectSrc, and SameSite cookies.
    FRONTEND_URL: z.string().url(),

    // Supabase (auth + storage).
    SUPABASE_URL: z.string().url(),
    SUPABASE_ANON_KEY: z.string().min(20),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    SUPABASE_BUCKET_NAME: z.string().min(1).optional(),

    // Gemini.
    GEMINI_API_KEY: z.string().min(20),

    // Stripe — secret + webhook signing key + price id for the PRO plan.
    STRIPE_SECRET_KEY: z.string().min(10),
    STRIPE_WEBHOOK_SECRET: z.string().min(10),
    STRIPE_PUBLISHABLE_KEY: z.string().min(10).optional(),
    STRIPE_PRICE_ID_PRO: z.string().min(5),

    // Redis — either single URL or host/port/password set.
    REDIS_URL: z.string().optional(),
    REDIS_HOST: z.string().optional(),
    REDIS_PORT: z.string().regex(/^\d+$/).optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_TLS: z.enum(['true', 'false']).optional(),

    // Optional observability hooks.
    SENTRY_DSN: z.string().url().optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .optional(),

    // Admin bootstrap. ADMIN_EMAILS is a comma-separated allowlist that
    // auto-promotes matching accounts to ADMIN on first authenticated request
    // (idempotent). The seed script reads ADMIN_SEED_EMAIL/PASSWORD to create
    // the initial SUPER_ADMIN; both fall back to documented defaults.
    ADMIN_EMAILS: z.string().optional(),
    ADMIN_SEED_EMAIL: z.string().email().optional(),
    ADMIN_SEED_PASSWORD: z.string().min(8).optional(),
  })
  .superRefine((env, ctx) => {
    if (!env.REDIS_URL && !env.REDIS_HOST) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message:
          'Either REDIS_URL or REDIS_HOST/REDIS_PORT must be set for BullMQ + cache + throttler.',
      });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(): AppEnv {
  const logger = new Logger('validateEnv');
  const result = envSchema.safeParse(process.env);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');

  // In production every issue is fatal — fail the deploy rather than silently
  // run a misconfigured app.
  const fatalInDev = process.env.NODE_ENV === 'production';

  const message = `Invalid environment configuration:\n${issues}`;
  if (fatalInDev) {
    logger.error(message);
    process.exit(1);
  }

  logger.warn(
    `${message}\n(Non-fatal in NODE_ENV=${process.env.NODE_ENV ?? 'development'} — fix before deploying.)`,
  );
  // Best-effort cast so the rest of the app still gets typed access.
  return process.env as unknown as AppEnv;
}
