import { PrismaClient, UserRole } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

/**
 * Idempotent seed for a regular test user — bypasses Supabase email
 * confirmation rate limits during local dev. Mirrors prisma/seed.ts
 * but creates a USER-role row instead of SUPER_ADMIN, and accepts the
 * email/password via env so the script never carries credentials.
 *
 * Usage:
 *   TEST_USER_EMAIL=ivaneltagonde5@gmail.com \
 *   TEST_USER_PASSWORD='Ivan2003' \
 *   TEST_USER_FULLNAME='Ivan Tagonde' \
 *   npx ts-node prisma/seed-test-user.ts
 *
 * Re-running is safe — Supabase user is upserted with email_confirm=true
 * and the local mirror row is upserted with emailVerified=true, so login
 * works immediately without clicking a confirmation link.
 */

async function main() {
  const email = (process.env.TEST_USER_EMAIL ?? '').toLowerCase();
  const password = process.env.TEST_USER_PASSWORD ?? '';
  const fullname = process.env.TEST_USER_FULLNAME ?? 'Test User';
  const role = (process.env.TEST_USER_ROLE as UserRole | undefined) ?? UserRole.USER;

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD are required env vars.',
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Seed requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env',
    );
  }

  const prisma = new PrismaClient();
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Look up existing Supabase auth user by email (page through up to 1000).
  let supaUserId: string | null = null;
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw new Error(`Supabase listUsers: ${list.error.message}`);
  const existing = list.data.users.find(
    (u) => (u.email ?? '').toLowerCase() === email,
  );

  if (existing) {
    supaUserId = existing.id;
    const upd = await supabase.auth.admin.updateUserById(supaUserId, {
      password,
      email_confirm: true,
    });
    if (upd.error) {
      console.warn(`Could not refresh Supabase user: ${upd.error.message}`);
    }
  } else {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { fullname },
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `Supabase createUser failed: ${created.error?.message ?? 'unknown'}`,
      );
    }
    supaUserId = created.data.user.id;
  }

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      Fullname: fullname,
      supabaseId: supaUserId!,
      password: await bcrypt.hash(password, 12),
      emailVerified: true,
      role,
    },
    update: {
      // Keep role / verified flags fresh on re-run, refresh password hash.
      role,
      emailVerified: true,
      supabaseId: supaUserId!,
      password: await bcrypt.hash(password, 12),
    },
  });

  await prisma.$disconnect();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Test user ready — sign in at /login with:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     ${role}`);
  console.log(`  emailVerified: true (Supabase + local both flipped)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((e: unknown) => {
  console.error('[seed-test-user] failed:', e);
  process.exit(1);
});
