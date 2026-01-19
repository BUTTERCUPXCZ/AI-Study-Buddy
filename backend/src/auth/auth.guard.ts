import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

/**
 * Extended Request interface to include authenticated user information
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    fullname: string;
  };
}

/**
 * AuthGuard - Protects routes by verifying JWT tokens
 * Attaches authenticated user information to the request object
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Try to get token from cookie first, then fall back to Authorization header
    let token = request.cookies?.['access_token'] as string | undefined;

    // Fall back to Authorization header for backward compatibility
    if (!token) {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7); // 'Bearer '.length === 7
      }
    }

    // Ensure token exists
    if (!token || (typeof token === 'string' && !token.trim())) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      // Verify the token and get user information
      const user = await this.authService.verifyToken(token ?? '');

      // Attach user to request object for use in controllers
      request.user = {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
      };

      return true;
    } catch (error) {
      // Log the error for debugging (optional, depending on your logging setup)
      console.error('Token verification failed:', error);

      // Provide more specific error messages based on error type if possible
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      } else if (error instanceof Error && error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      } else {
        throw new UnauthorizedException('Authentication failed');
      }
    }
  }
}
