import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { DatabaseService } from '../../database/database.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    fullname: string;
  };
}

@Injectable()
export class UsageGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Get user with subscription status
    const dbUser = await this.databaseService.user.findUnique({
      where: { id: user.id },
      select: {
        subscriptionStatus: true,
        attemptsUsed: true,
      },
    });

    if (!dbUser) {
      return false;
    }

    // Pro users have unlimited access
    if (dbUser.subscriptionStatus === 'PRO') {
      return true;
    }

    // Free users: check if they've exceeded limit
    if (dbUser.attemptsUsed >= 5) {
      throw new ForbiddenException(
        'You have reached your free plan limit of 5 attempts. Please upgrade to Pro for unlimited access.',
      );
    }

    return true;
  }
}
