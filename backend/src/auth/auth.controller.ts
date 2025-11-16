import { Controller, Get, Post, Body, Patch, Param, Delete, Headers, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/Register-dto';
import { Provider } from '@supabase/supabase-js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() createAuthDto: RegisterDto) {
    return this.authService.Register(createAuthDto);
  }

  @Post('login')
  login(@Body() createAuthDto: RegisterDto) {
    return this.authService.Login(createAuthDto);
  }

  @Get('me')
  async getMe(@Headers('authorization') authHeader: string){
    const token = authHeader?.split(' ')[1];
    return this.authService.verifyToken(token);
  }

  /**
   * Initiate OAuth flow
   * GET /auth/oauth?provider=google
   * GET /auth/oauth?provider=github
   */
  @Get('oauth')
  async initiateOAuth(@Query('provider') provider: string) {
    const validProviders = ['google', 'github', 'facebook', 'twitter', 'azure', 'linkedin'];
    
    if (!provider || !validProviders.includes(provider.toLowerCase())) {
      throw new BadRequestException(`Invalid provider. Valid providers: ${validProviders.join(', ')}`);
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

}
