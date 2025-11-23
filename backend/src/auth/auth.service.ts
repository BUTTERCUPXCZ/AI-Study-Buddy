import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RegisterDto } from './dto/Register-dto';
import { LoginDto } from './dto/Login-dto';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { createClient, Provider, SupabaseClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as unknown as SupabaseClient;
  }

  /**
   * Get OAuth sign-in URL for specified provider
   * @param provider - OAuth provider (google, github, etc.)
   * @returns OAuth URL and provider name
   */
  async getOAuthUrl(provider: Provider) {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

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

  /**
   * Handle OAuth callback and create/update user in database
   * @param token - Access token from OAuth provider
   * @returns User information
   */
  async handleOAuthCallback(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid OAuth token');
    }

    const supabaseUser = data.user;

    // Check if user exists in our database
    let dbUser = await this.databaseService.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (!dbUser) {
      // Create new user from OAuth data
      const fullname =
        (supabaseUser.user_metadata?.full_name as string) ||
        (supabaseUser.user_metadata?.fullname as string) ||
        (supabaseUser.user_metadata?.name as string) ||
        supabaseUser.email!.split('@')[0];

      dbUser = await this.databaseService.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email!,
          Fullname: fullname,
          password: '', // OAuth users don't have passwords
        },
      });
    } else {
      // Update existing user info if needed
      const fullname =
        (supabaseUser.user_metadata?.full_name as string) ||
        (supabaseUser.user_metadata?.fullname as string) ||
        (supabaseUser.user_metadata?.name as string) ||
        dbUser.Fullname;

      dbUser = await this.databaseService.user.update({
        where: { supabaseId: supabaseUser.id },
        data: {
          email: supabaseUser.email!,
          Fullname: fullname,
        },
      });
    }

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
      throw new BadRequestException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

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

    await this.databaseService.user.create({
      data: {
        supabaseId: supabaseUser.id,
        Fullname: registerDto.Fullname,
        email: registerDto.email,
        password: hashedPassword,
      },
    });

    return {
      message: 'User registered successfully. Please verify your email.',
    };
  }
  async Login(loginDto: LoginDto) {
    const existingUser = await this.databaseService.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!existingUser) {
      throw new BadRequestException(
        'No account found with this email address.',
      );
    }

    const { data, error } = await this.supabase.auth.signInWithPassword({
      email: loginDto.email,
      password: loginDto.password,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    const { user, session } = data;

    // 3️⃣ Double-check Supabase user (edge case)
    if (!user) {
      throw new UnauthorizedException(
        'Authentication failed. Please try again.',
      );
    }

    // Type the user to avoid unsafe assignment
    const typedUser = user as {
      email?: string;
      user_metadata?: { fullname?: string };
    };

    // 4️⃣ Return successful response
    return {
      message: 'Login successful',
      access_token: session.access_token,
      user: {
        id: existingUser.id, // Use database ID
        email: typedUser.email,
        fullname: typedUser.user_metadata?.fullname || existingUser.Fullname,
      },
    };
  }

  async verifyToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user)
      throw new UnauthorizedException('Invalid or expired token');

    const supabaseUser = data.user as {
      id: string;
      email?: string;
      user_metadata?: { fullname?: string };
    };

    // Check if user exists in our database, if not create them (OAuth users)
    let dbUser = await this.databaseService.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (!dbUser) {
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
    }

    return {
      id: dbUser.id, // Use database ID
      email: supabaseUser.email,
      fullname: dbUser.Fullname,
      supabaseUser: supabaseUser,
    };
  }
}
