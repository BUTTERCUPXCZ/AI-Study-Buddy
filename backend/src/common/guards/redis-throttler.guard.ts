import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';

interface RequestWithUser extends Record<string, unknown> {
  user?: {
    id: string;
  };
  ip?: string;
}

@Injectable()
export class RedisThrottlerGuard extends ThrottlerGuard {
  // eslint-disable-next-line @typescript-eslint/require-await
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as RequestWithUser;
    // Use user ID if authenticated, otherwise use IP address
    return request.user?.id ?? request.ip ?? 'anonymous';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const result = await super.canActivate(context);

    // Add rate limit headers
    const response = context.switchToHttp().getResponse<Response>();

    // Try to add informative headers
    if (response && !response.headersSent) {
      response.setHeader('X-RateLimit-Type', 'redis');
    }

    return result;
  }
}
