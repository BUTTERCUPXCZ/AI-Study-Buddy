import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/Register-dto';
import { LoginDto } from './dto/Login-dto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { createClient, Provider, SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../common/services/audit.service';

// S1 — brute-force protection knobs.
// Tightened per UX spec: 3 wrong attempts → 60s lockout, surfaced as a
// countdown in the frontend. The per-IP fallback stays at a coarser
// threshold so a distributed attacker still trips it eventually.
const FAILED_LOGIN_WINDOW_S = 60; // 60 seconds
const FAILED_LOGIN_THRESHOLD = 3; // attempts before lockout
const FAILED_IP_WINDOW_S = 60 * 60; // 1 hour
const FAILED_IP_THRESHOLD = 50; // attempts spread across emails

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly auditService: AuditService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as unknown as SupabaseClient;
  }

  // ----- S1 — brute-force protection helpers -----------------------------

  private emailKey(email: string): string {
    // Hash so the Redis dump never carries plaintext addresses.
    const h = createHash('sha256')
      .update(email.toLowerCase().trim())
      .digest('hex');
    return `auth:fail:email:${h}`;
  }

  private ipKey(ip: string | undefined): string | null {
    if (!ip) return null;
    return `auth:fail:ip:${ip}`;
  }

  /**
   * S1 — refuse login when the account is currently locked due to repeated
   * failed attempts. Throws 429 with `retryAfter` so the frontend countdown
   * UI works without changes.
   */
  async assertNotLocked(email: string, ip?: string): Promise<void> {
    try {
      const eKey = this.emailKey(email);
      const eCount = await this.redisService.get<string>(eKey);
      if (eCount && Number(eCount) >= FAILED_LOGIN_THRESHOLD) {
        const ttl = await this.redisService.ttl(eKey);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Account temporarily locked. Try again later.',
            error: 'Too Many Requests',
            isRateLimited: true,
            retryAfter: ttl > 0 ? ttl : FAILED_LOGIN_WINDOW_S,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const iKey = this.ipKey(ip);
      if (iKey) {
        const iCount = await this.redisService.get<string>(iKey);
        if (iCount && Number(iCount) >= FAILED_IP_THRESHOLD) {
          const ttl = await this.redisService.ttl(iKey);
          throw new HttpException(
            {
              statusCode: HttpStatus.TOO_MANY_REQUESTS,
              message:
                'Too many failed attempts from this network. Try again later.',
              error: 'Too Many Requests',
              isRateLimited: true,
              retryAfter: ttl > 0 ? ttl : FAILED_IP_WINDOW_S,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
    } catch (err) {
      // Re-throw HTTP errors; swallow Redis errors so a Redis blip doesn't
      // lock everyone out (fail-open for availability).
      if (err instanceof HttpException) throw err;
      this.logger.warn(
        `assertNotLocked: Redis unavailable, allowing login attempt: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
  }

  /**
   * S1 — increment failure counters after a wrong password. Audits when
   * the email-keyed counter crosses the lockout threshold so operators
   * can correlate.
   */
  async recordFailedLogin(email: string, ip?: string): Promise<void> {
    try {
      const eKey = this.emailKey(email);
      const count = await this.redisService.incr(eKey);
      if (count === 1) {
        await this.redisService.expire(eKey, FAILED_LOGIN_WINDOW_S);
      }
      this.auditService.record({
        action: 'login_failed',
        target: email,
        meta: { ip, attempt: count },
      });
      if (count === FAILED_LOGIN_THRESHOLD) {
        this.auditService.record({
          action: 'account_locked',
          target: email,
          meta: { ip, lockoutSeconds: FAILED_LOGIN_WINDOW_S },
        });
      }

      const iKey = this.ipKey(ip);
      if (iKey) {
        const ipCount = await this.redisService.incr(iKey);
        if (ipCount === 1) {
          await this.redisService.expire(iKey, FAILED_IP_WINDOW_S);
        }
      }
    } catch (err) {
      this.logger.warn(
        `recordFailedLogin: Redis unavailable: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
  }

  /** S1 — successful login resets the per-email counter. */
  async clearFailedLogin(email: string): Promise<void> {
    try {
      await this.redisService.del(this.emailKey(email));
    } catch {
      // best-effort
    }
  }

  /**
   * Get OAuth sign-in URL for specified provider
   * @param provider - OAuth provider (google, github, etc.)
   * @returns OAuth URL and provider name
   */
  async getOAuthUrl(provider: Provider) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${frontendUrl}/supabaseCallback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new BadRequestException(`OAuth error: ${error.message}`);
    }

    return {
      url: data.url,
      provider: data.provider,
    };
  }

  async handleOAuthCallback(token: string, response: any) {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid OAuth token');
    }

    const supabaseUser = data.user;

    // Check if user exists in our database
    const existingUser = await this.databaseService.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    type UserRecord = {
      id: string;
      email: string;
      Fullname: string;
      role?: import('@prisma/client').UserRole;
    };
    let dbUser: UserRecord;
    if (!existingUser) {
      // The email might already belong to a row that was created via
      // email/password signup, OR by a previous OAuth flow whose
      // Supabase user was later deleted/recreated. Either way the
      // OAuth provider just proved the user owns that email, so we
      // safely link the new supabaseId onto the existing row instead
      // of (a) throwing a confusing error or (b) racing two
      // concurrent inserts into the same `email` unique constraint.
      const existingByEmail = await this.databaseService.user.findUnique({
        where: { email: supabaseUser.email! },
      });

      const fullname =
        (supabaseUser.user_metadata?.full_name as string) ||
        (supabaseUser.user_metadata?.fullname as string) ||
        (supabaseUser.user_metadata?.name as string) ||
        existingByEmail?.Fullname ||
        supabaseUser.email!.split('@')[0];

      if (existingByEmail) {
        // Link the OAuth identity to the existing account. If Supabase
        // has email_confirmed_at set (any successful confirm-link click
        // OR any OAuth provider that asserts the email), flip the local
        // verified flag too — this is the path PKCE-style email-confirm
        // links flow through, so it's where we reconcile that state.
        dbUser = await this.databaseService.user.update({
          where: { id: existingByEmail.id },
          data: {
            supabaseId: supabaseUser.id,
            Fullname: fullname,
            ...(supabaseUser.email_confirmed_at ? { emailVerified: true } : {}),
          },
        });
      } else {
        // First time we see this user — create the row. Wrap in a
        // P2002 catch so a near-simultaneous OAuth callback that
        // already inserted the row falls back to reading the existing
        // one instead of crashing.
        try {
          dbUser = await this.databaseService.user.create({
            data: {
              supabaseId: supabaseUser.id,
              email: supabaseUser.email!,
              Fullname: fullname,
              password: '', // OAuth users don't have passwords
              emailVerified: !!supabaseUser.email_confirmed_at,
            },
          });
        } catch (err: unknown) {
          const e = err as { code?: string };
          if (e?.code === 'P2002') {
            // Race: another concurrent callback won. Re-read by
            // supabaseId, then fall back to email.
            const racedById = await this.databaseService.user.findUnique({
              where: { supabaseId: supabaseUser.id },
            });
            const racedByEmail =
              racedById ??
              (await this.databaseService.user.findUnique({
                where: { email: supabaseUser.email! },
              }));
            if (!racedByEmail) throw err;
            dbUser = racedByEmail;
          } else {
            throw err;
          }
        }
      }
    } else {
      // Update existing user info if needed
      const fullname =
        (supabaseUser.user_metadata?.full_name as string) ||
        (supabaseUser.user_metadata?.fullname as string) ||
        (supabaseUser.user_metadata?.name as string) ||
        existingUser.Fullname;

      dbUser = await this.databaseService.user.update({
        where: { supabaseId: supabaseUser.id },
        data: {
          email: supabaseUser.email!,
          Fullname: fullname,
          // PKCE-style email-confirm links land here (no `type=signup`
          // available post-redirect). Flip the local flag whenever
          // Supabase has confirmed the email — never downgrade.
          ...(supabaseUser.email_confirmed_at && !existingUser.emailVerified
            ? { emailVerified: true }
            : {}),
        },
      });
      if (supabaseUser.email_confirmed_at && !existingUser.emailVerified) {
        this.logger.log({
          event: 'email_verify_synced_via_oauth_callback',
          userId: dbUser.id,
        });
      }
    }

    // Set HTTP-only cookie
    this.setAuthCookie(response, token);

    return {
      message: 'OAuth login successful',
      user: {
        id: dbUser.id, // Use database ID, not supabaseId
        email: dbUser.email,
        fullname: dbUser.Fullname,
      },
    };
  }

  async Register(registerDto: RegisterDto) {
    const existingUser = await this.databaseService.user.findUnique({
      where: { email: registerDto.email },
    });
    if (existingUser) {
      throw new BadRequestException(
        'This email already exists. Use another one.',
      );
    }

    // Bcrypt cost factor 12 — ~300ms/hash on commodity hardware, raises
    // the cost of offline cracking by ~4x compared with rounds=10.
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    const { data, error } = await this.supabase.auth.signUp({
      email: registerDto.email,
      password: registerDto.password,
      options: {
        data: { fullname: registerDto.Fullname },
        emailRedirectTo: `${frontendUrl}/supabaseCallback`,
      },
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const supabaseUser = data.user;

    if (!supabaseUser) {
      throw new UnauthorizedException('User registration failed');
    }

    const newUser = await this.databaseService.user.create({
      data: {
        supabaseId: supabaseUser.id,
        Fullname: registerDto.Fullname,
        email: registerDto.email,
        password: hashedPassword,
      },
    });

    if (!newUser) {
      throw new BadRequestException('Failed to create user in database');
    }

    return {
      message: 'User registered successfully. Please verify your email.',
    };
  }
  async Login(loginDto: LoginDto, response: any, requestIp?: string) {
    // S1 — refuse the attempt outright if the email or source IP is in
    // lockout. Done BEFORE the user-existence check so an attacker can't
    // use response timing to enumerate accounts during a lockout window.
    await this.assertNotLocked(loginDto.email, requestIp);

    const dbUser = await this.databaseService.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!dbUser) {
      // Don't reveal that the email isn't registered — but still count it
      // as a failed attempt so a probe can't enumerate accounts.
      await this.recordFailedLogin(loginDto.email, requestIp);
      throw new BadRequestException('Invalid email or password.');
    }

    // Email-verified gate. The user might know their password but never
    // clicked the verification link in the registration email; sending
    // them through Supabase first wastes a round-trip and would also
    // bump the failed-login counter even though the password is fine.
    // Surface a specific message: account existence is already implied
    // by the registration flow that brought them here, so this isn't an
    // enumeration risk.
    if (dbUser.emailVerified === false) {
      throw new UnauthorizedException(
        'Email not verified. Please check your inbox to verify your email before signing in.',
      );
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error) {
      // Supabase may also reject unverified accounts itself ("Email not
      // confirmed") if the project requires email confirmation. Map that
      // to the same friendly message rather than a generic credential
      // failure.
      const msg = (error.message ?? '').toLowerCase();
      const code = (error as { code?: string }).code ?? '';
      const isUnverified =
        code === 'email_not_confirmed' ||
        msg.includes('email not confirmed') ||
        msg.includes('not confirmed') ||
        msg.includes('email not verified');
      if (isUnverified) {
        throw new UnauthorizedException(
          'Email not verified. Please check your inbox to verify your email before signing in.',
        );
      }

      // S1 — credential failure: record and return a generic message so
      // an attacker can't distinguish "wrong password" from "wrong email".
      await this.recordFailedLogin(loginDto.email, requestIp);
      throw new BadRequestException('Invalid email or password.');
    }

    // S1 — login succeeded, reset the counter so a legitimate user who
    // mis-typed once doesn't carry penalty into future sessions.
    await this.clearFailedLogin(loginDto.email);

    const { user, session } = data;

    // 3️⃣ Double-check Supabase user (edge case)
    if (!user) {
      throw new UnauthorizedException(
        'Authentication failed. Please try again.',
      );
    }

    // Check if email is verified
    if (!user.email_confirmed_at) {
      throw new UnauthorizedException(
        'Please verify your email address before logging in.',
      );
    }

    // Type the user to avoid unsafe assignment
    const typedUser = user as {
      email?: string;
      user_metadata?: { fullname?: string };
    };

    // Set HTTP-only cookie
    this.setAuthCookie(response, session.access_token);

    // 4️⃣ Return successful response (without token in body)
    return {
      message: 'Login successful',
      user: {
        id: dbUser.id, // Use database ID
        email: typedUser.email,
        fullname: typedUser.user_metadata?.fullname || dbUser.Fullname,
      },
    };
  }

  async verifyToken(token: string) {
    // Cache validated tokens in Redis (5-min TTL). The hot path on a
    // dashboard fires 2-3 protected requests in parallel; without this
    // each one re-hits Supabase + Postgres for the same token.
    //
    // Trade-off: a logged-out user whose access_token cookie was somehow
    // re-attached has up to 5 min of stale validity. Acceptable because
    // (a) logout clears the cookie itself so replay requires the
    // attacker to have already captured it, and (b) Supabase rotates
    // refresh tokens so a stolen access token is short-lived anyway.
    const cacheKey =
      'auth:token:' + createHash('sha256').update(token).digest('hex');
    try {
      const cached = await this.redisService.get<string>(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          id: string;
          email?: string;
          fullname: string;
          supabaseUser: { id: string; email?: string };
        };
        return parsed;
      }
    } catch (err) {
      // Redis hiccup → fall through to live verification.
      this.logger.warn(
        `verifyToken cache lookup failed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user)
      throw new UnauthorizedException('Invalid or expired token');

    const supabaseUser = data.user as {
      id: string;
      email?: string;
      user_metadata?: { fullname?: string; full_name?: string; name?: string };
    };

    // Check if user exists in our database, if not create them (OAuth users)
    const existingDbUser = await this.databaseService.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    type UserRecord = {
      id: string;
      email: string;
      Fullname: string;
      role?: import('@prisma/client').UserRole;
    };
    let dbUser: UserRecord;
    if (!existingDbUser) {
      // Check if email already exists from a different account
      const existingByEmail = await this.databaseService.user.findUnique({
        where: { email: supabaseUser.email! },
      });
      if (existingByEmail) {
        throw new BadRequestException(
          'This email is already registered with a different account. Please use email/password login.',
        );
      }

      // This is an OAuth user signing in for the first time
      // Create a record in our database
      dbUser = await this.databaseService.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email!,
          Fullname:
            (supabaseUser.user_metadata?.fullname as string) ||
            (supabaseUser.user_metadata?.full_name as string) ||
            (supabaseUser.user_metadata?.name as string) ||
            supabaseUser.email!.split('@')[0],
          password: '', // OAuth users don't have passwords
        },
      });
    } else {
      dbUser = existingDbUser;
    }

    const result = {
      id: dbUser.id, // Use database ID
      email: supabaseUser.email,
      fullname: dbUser.Fullname,
      role: dbUser.role ?? 'USER',
      supabaseUser: supabaseUser,
    };

    // Best-effort cache write — never block the request on Redis.
    void this.redisService
      .set(cacheKey, JSON.stringify(result), 300)
      .catch(() => undefined);

    return result;
  }

  /**
   * Resend email verification
   * @param email - User's email address
   * @returns Success message
   */
  async resendVerificationEmail(email: string) {
    const { error } = await this.supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      throw new BadRequestException(
        `Failed to resend verification email: ${error.message}`,
      );
    }

    return {
      message: 'Verification email sent successfully. Please check your inbox.',
    };
  }

  /**
   * Verify email with token
   * @param token - Verification token
   * @returns Success message
   */
  async verifyEmail(token: string) {
    const { error } = await this.supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email',
    });

    if (error) {
      throw new BadRequestException(
        `Email verification failed: ${error.message}`,
      );
    }

    return {
      message: 'Email verified successfully. You can now log in.',
    };
  }

  /**
   * Email-link verification callback.
   *
   * Supabase's email-confirm link redirects the browser to our
   * `/supabaseCallback` with an access_token in the URL hash. The token
   * proves Supabase has flipped its own `auth.users.email_confirmed_at`,
   * but our local mirror table doesn't know that yet. This method
   * exchanges the token for the Supabase user, verifies confirmation
   * actually happened (refuse to flip the flag otherwise), and writes
   * `emailVerified=true` on the matching local user.
   *
   * Idempotent — calling twice is a no-op so a user clicking the link
   * twice doesn't get a confusing error.
   */
  async confirmEmailVerification(
    accessToken: string,
  ): Promise<{ message: string; userId?: string }> {
    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      this.logger.warn({ event: 'email_verify_invalid_token' });
      throw new UnauthorizedException('Invalid or expired verification token');
    }
    if (!data.user.email_confirmed_at) {
      // Refuse to flip the local flag if Supabase itself hasn't
      // confirmed the email. Defence in depth — a stolen token before
      // confirmation completed would otherwise let an attacker bypass
      // the verification gate.
      this.logger.warn({
        event: 'email_verify_unconfirmed',
        supabaseUserId: data.user.id,
      });
      throw new BadRequestException('Email not yet confirmed by Supabase');
    }
    const localUser = await this.databaseService.user.findUnique({
      where: { supabaseId: data.user.id },
    });
    if (!localUser) {
      this.logger.warn({
        event: 'email_verify_user_missing',
        supabaseUserId: data.user.id,
      });
      throw new BadRequestException('Local user not found');
    }
    if (localUser.emailVerified) {
      this.logger.log({
        event: 'email_verify_already_verified',
        userId: localUser.id,
      });
      return { message: 'Email already verified', userId: localUser.id };
    }
    await this.databaseService.user.update({
      where: { id: localUser.id },
      data: { emailVerified: true },
    });
    this.logger.log({ event: 'email_verify_success', userId: localUser.id });
    return {
      message: 'Email verified successfully. You can now log in.',
      userId: localUser.id,
    };
  }

  /**
   * Set HTTP-only cookie with access token
   * @param response - Express response object
   * @param token - Access token to store
   */
  private setAuthCookie(
    response: {
      cookie: (
        name: string,
        value: string,
        options: Record<string, unknown>,
      ) => void;
    },
    token: string,
  ) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    response.cookie('access_token', token, {
      httpOnly: true, // Prevent XSS attacks
      secure: isProduction, // Use HTTPS in production
      sameSite: isProduction ? 'none' : 'lax', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });
  }
}
