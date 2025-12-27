import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  BadRequestException,
} from '@nestjs/common';
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
  login(@Body() createAuthDto: LoginDto) {
    return this.authService.Login(createAuthDto);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader: string) {
    const token = authHeader?.split(' ')[1];
    return this.authService.verifyToken(token);
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
  async handleOAuthCallback(@Body('access_token') accessToken: string) {
    if (!accessToken) {
      throw new BadRequestException('Access token is required');
    }

    return this.authService.handleOAuthCallback(accessToken);
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
