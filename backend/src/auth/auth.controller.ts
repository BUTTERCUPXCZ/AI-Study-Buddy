import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  BadRequestException,
  Res,
  Req,
} from '@nestjs/common';
import express from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/Register-dto';
import { LoginDto } from './dto/Login-dto';
import { Provider } from '@supabase/supabase-js';
import { Throttle } from '../common/decorators/throttle.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(3, 60) // 3 registrations per minute per IP
  register(@Body() createAuthDto: RegisterDto) {
    return this.authService.Register(createAuthDto);
  }

  @Post('login')
  @Throttle(5, 60) // 5 login attempts per minute per IP
  async login(
    @Body() createAuthDto: LoginDto,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    return this.authService.Login(createAuthDto, response);
  }

  @Get('me')
  async getMe(@Req() request: express.Request) {
    const token = request.cookies?.['access_token'] as string | undefined;
    return this.authService.verifyToken(token ?? '');
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: express.Response) {
    // Clear the cookie
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Initiate OAuth flow
   * GET /auth/oauth?provider=google
   * GET /auth/oauth?provider=github
   */
  @Get('oauth')
  @Throttle(5, 60) // 5 OAuth initiations per minute
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

  /**
   * Handle OAuth callback (called by frontend after Supabase redirect)
   * POST /auth/oauth/callback
   * Body: { access_token: string }
   */
  @Post('oauth/callback')
  async handleOAuthCallback(
    @Body('access_token') accessToken: string,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    if (!accessToken) {
      throw new BadRequestException('Access token is required');
    }

    return this.authService.handleOAuthCallback(accessToken, response);
  }

  /**
   * Resend email verification
   * POST /auth/resend-verification
   * Body: { email: string }
   */
  @Post('resend-verification')
  @Throttle(3, 300) // 3 resend requests per 5 minutes per IP
  async resendVerification(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    return this.authService.resendVerificationEmail(email);
  }

  /**
   * Verify email with token
   * POST /auth/verify-email
   * Body: { token: string }
   */
  @Post('verify-email')
  async verifyEmail(@Body('token') token: string) {
    if (!token) {
      throw new BadRequestException('Verification token is required');
    }

    return this.authService.verifyEmail(token);
  }
}
