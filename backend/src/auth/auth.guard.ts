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
    const authHeader = request.headers.authorization;

    // Check if authorization header exists
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    // Validate Bearer token format
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Invalid authorization header format. Expected: Bearer <token>',
      );
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.slice(7); // 'Bearer '.length === 7

    // Ensure token is not empty
    if (!token.trim()) {
      throw new UnauthorizedException('Token is required');
    }

    try {
      // Verify the token and get user information
      const user = await this.authService.verifyToken(token);

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
