import { PrismaClient, UserRole } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

/**
 * Idempotent seed that creates (or upgrades) a SUPER_ADMIN user.
 *
 * Run after `prisma migrate deploy`:
 *   npx prisma db seed
 *
 * Override credentials with:
 *   ADMIN_SEED_EMAIL=you@x.com ADMIN_SEED_PASSWORD='Strong!1' npx prisma db seed
 *
 * Default fallback (printed at the end so a fresh dev clone Just Works):
 *   admin@buds-ai.local / ChangeMe!Admin123
 *
 * Re-running is safe — existing rows are upserted to role=SUPER_ADMIN
 * and emailVerified=true.
 */

const DEFAULT_EMAIL = 'admin@buds-ai.local';
const DEFAULT_PASSWORD = 'ChangeMe!Admin123';

async function main() {
  const email = (process.env.ADMIN_SEED_EMAIL ?? DEFAULT_EMAIL).toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD ?? DEFAULT_PASSWORD;

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Seed requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env',
    );
  }

  const prisma = new PrismaClient();
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find existing Supabase auth user by email (paginate up to 1000).
  let supaUserId: string | null = null;
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw new Error(`Supabase listUsers: ${list.error.message}`);
  const existing = list.data.users.find(
    (u) => (u.email ?? '').toLowerCase() === email,
  );
  if (existing) {
    supaUserId = existing.id;
    // Ensure email_confirmed_at + password are current. updateUserById
    // is a no-op if the password matches; if it doesn't, re-set it.
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
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `Supabase createUser failed: ${created.error?.message ?? 'unknown'}`,
      );
    }
    supaUserId = created.data.user.id;
  }

  // Upsert local mirror row, force role=SUPER_ADMIN + verified.
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      Fullname: 'Super Admin',
      supabaseId: supaUserId!,
      password: await bcrypt.hash(password, 12),
      emailVerified: true,
      role: UserRole.SUPER_ADMIN,
    },
    update: {
      role: UserRole.SUPER_ADMIN,
      emailVerified: true,
      supabaseId: supaUserId!,
    },
  });

  await prisma.$disconnect();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SUPER_ADMIN ready — sign in at /login with:');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log('  After first login, rotate the password.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((e: unknown) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});
