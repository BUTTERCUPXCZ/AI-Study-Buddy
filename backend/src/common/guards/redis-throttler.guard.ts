import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class RedisThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Use user ID if authenticated, otherwise use IP address
    return req.user?.id || req.ip || 'anonymous';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const result = await super.canActivate(context);
      
      // Add rate limit headers
      const response = context.switchToHttp().getResponse();
      const request = context.switchToHttp().getRequest();
      
      // Try to add informative headers
      if (response && !response.headersSent) {
        response.setHeader('X-RateLimit-Type', 'redis');
      }
      
      return result;
    } catch (error) {
      // Re-throw throttler exceptions
      throw error;
    }
  }
}
