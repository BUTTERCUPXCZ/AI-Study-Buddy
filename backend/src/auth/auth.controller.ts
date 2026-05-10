import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  HttpCode,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/Register-dto';
import { LoginDto } from './dto/Login-dto';
import { Provider } from '@supabase/supabase-js';
import { Throttle } from '../common/decorators/throttle.decorator';
import { AuditService } from '../common/services/audit.service';
import { issueCsrfCookie } from '../common/middleware/csrf.middleware';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  @Post('register')
  @Throttle(3, 60)
  async register(
    @Body() createAuthDto: RegisterDto,
    @Req() request: express.Request,
  ) {
    const result = await this.authService.Register(createAuthDto);
    this.auditService.record({
      action: 'register',
      target: createAuthDto.email,
      request,
    });
    return result;
  }

  @Post('login')
  // 3 attempts per 60s per IP — matches the per-account S1 lockout window.
  @Throttle(3, 60)
  async login(
    @Body() createAuthDto: LoginDto,
    @Res({ passthrough: true }) response: express.Response,
    @Req() request: express.Request,
  ) {
    try {
      const result = await this.authService.Login(
        createAuthDto,
        response,
        request.ip,
      );
      this.auditService.record({
        action: 'login',
        userId: result.user?.id,
        target: createAuthDto.email,
        request,
      });
      return result;
    } catch (err) {
      this.auditService.record({
        action: 'login_failed',
        target: createAuthDto.email,
        request,
      });
      throw err;
    }
  }

  @Get('me')
  async getMe(
    @Req() request: express.Request,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const token = request.cookies?.['access_token'] as string | undefined;
    const user = await this.authService.verifyToken(token ?? '');
    // S11 — issue (or refresh) the CSRF token cookie on every authenticated
    // session bootstrap. Frontend reads it from document.cookie and echoes
    // it as X-CSRF-Token on every mutation.
    issueCsrfCookie(response);
    return user;
  }

  @Get('csrf')
  csrf(@Res({ passthrough: true }) response: express.Response) {
    // Public endpoint that issues a fresh CSRF token, used by the
    // frontend before the user is authenticated (e.g. on a forgot-password
    // flow). Returns the token in the body so SPA code can synchronise
    // its in-memory copy with the cookie.
    const token = issueCsrfCookie(response);
    return { csrfToken: token };
  }

  @Post('logout')
  logout(
    @Res({ passthrough: true }) response: express.Response,
    @Req() request: express.Request,
  ) {
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    // Best-effort audit; the cookie may be invalid here so we don't try
    // to resolve userId — the IP/UA is enough to correlate the action.
    this.auditService.record({ action: 'logout', request });

    return { message: 'Logged out successfully' };
  }

  @Get('oauth')
  @Throttle(5, 60)
  async initiateOAuth(@Query('provider') provider: string) {
    const validProviders = [
      'google',
      'github',
      'facebook',
      'twitter',
      'azure',
      'linkedin',
    ];

    if (!provider || !validProviders.includes(provider.toLowerCase())) {
      throw new BadRequestException(
        `Invalid provider. Valid providers: ${validProviders.join(', ')}`,
      );
    }

    return this.authService.getOAuthUrl(provider as Provider);
  }

  @Post('oauth/callback')
  async handleOAuthCallback(
    @Body('access_token') accessToken: string,
    @Res({ passthrough: true }) response: express.Response,
    @Req() request: express.Request,
  ) {
    if (!accessToken) {
      throw new BadRequestException('Access token is required');
    }

    const result = await this.authService.handleOAuthCallback(
      accessToken,
      response,
    );
    this.auditService.record({
      action: 'oauth_login',
      userId: result.user?.id,
      request,
    });
    return result;
  }

  @Post('resend-verification')
  @Throttle(3, 300)
  async resendVerification(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    return this.authService.resendVerificationEmail(email);
  }

  @Post('verify-email')
  async verifyEmail(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    return this.authService.verifyEmail(token);
  }

  /**
   * Email-link verification callback. The frontend `/supabaseCallback`
   * route reads the access_token Supabase returns in the URL hash after
   * a successful confirmation click and POSTs it here. We verify the
   * token with Supabase, confirm `email_confirmed_at` is set, and flip
   * the local `User.emailVerified` flag so the EmailVerifiedGuard
   * starts allowing the user through on subsequent requests.
   */
  @Post('verify-email/callback')
  @HttpCode(HttpStatus.OK)
  async verifyEmailCallback(
    @Body('access_token') accessToken: string,
    @Req() request: express.Request,
  ) {
    if (!accessToken) {
      throw new BadRequestException('Access token is required');
    }
    try {
      const result =
        await this.authService.confirmEmailVerification(accessToken);
      this.auditService.record({
        action: 'email_verified',
        userId: result.userId ?? null,
        request,
      });
      return { message: result.message };
    } catch (err) {
      // Log the failure class (not the raw token / message) so the audit
      // table can't be turned into a side-channel for sensitive data.
      const reason =
        err instanceof Error ? err.constructor.name : 'UnknownError';
      this.auditService.record({
        action: 'email_verify_failed',
        target: reason,
        request,
      });
      throw err;
    }
  }
}
