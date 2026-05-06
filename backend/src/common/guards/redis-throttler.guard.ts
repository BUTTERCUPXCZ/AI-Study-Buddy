import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  THROTTLE_KEY,
  ThrottleOptions,
} from '../decorators/throttle.decorator';
import { RedisService } from '../../redis/redis.service';

interface RequestWithUser extends Request {
  user?: { id: string };
}

// Atomic rate-limit script. INCR the counter and, on first hit, set the
// TTL. Always return [count, ttl-remaining] in one round-trip so callers
// never observe a partial state. If the key somehow has no TTL (e.g.
// manual flush in between calls) we re-set it so the window can't drift
// into infinity.
const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if current == 1 or ttl < 0 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  ttl = tonumber(ARGV[1])
end
return {current, ttl}
`;

@Injectable()
export class RedisThrottlerGuard {
  private readonly logger = new Logger(RedisThrottlerGuard.name);

  private readonly DEFAULT_LIMIT = 100;
  private readonly DEFAULT_TTL_SECONDS = 60;

  constructor(
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const classRef = context.getClass();

    const throttleOptions = this.reflector.get<ThrottleOptions>(
      THROTTLE_KEY,
      handler,
    );
    const classOptions = this.reflector.get<ThrottleOptions>(
      THROTTLE_KEY,
      classRef,
    );
    const options = throttleOptions ?? classOptions;

    if (options?.skip) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const response = context.switchToHttp().getResponse<Response>();

    const tracker = this.getTracker(request);
    const route = handler.name;
    const limit = options?.limit ?? this.DEFAULT_LIMIT;
    const ttlSeconds = options?.ttl ?? this.DEFAULT_TTL_SECONDS;

    const key = `rate-limit:${tracker}:${route}`;

    try {
      const result = await this.redisService.runScript<[number, number]>(
        RATE_LIMIT_SCRIPT,
        [key],
        [ttlSeconds],
      );
      const [current, ttlRemaining] = Array.isArray(result)
        ? result
        : [Number(result), ttlSeconds];
      const timeToExpire = ttlRemaining > 0 ? ttlRemaining : ttlSeconds;

      if (!response.headersSent) {
        response.setHeader('X-RateLimit-Limit', limit);
        response.setHeader(
          'X-RateLimit-Remaining',
          Math.max(0, limit - current),
        );
        response.setHeader('X-RateLimit-Reset', timeToExpire);
      }

      if (current > limit) {
        if (!response.headersSent) {
          response.setHeader('Retry-After', ttlSeconds);
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Too many requests. Please try again in ${ttlSeconds} seconds.`,
            error: 'Too Many Requests',
            isRateLimited: true,
            retryAfter: ttlSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;

      // Fail-open: a Redis outage must not break login. Logged so it's
      // visible in metrics. Comment kept because the trade-off (security
      // vs availability) is non-obvious for a future reader.
      this.logger.warn(
        `Rate limit check failed for ${key}, allowing request: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      return true;
    }
  }

  private getTracker(request: RequestWithUser): string {
    if (request.user?.id) return `user:${request.user.id}`;
    if (request.ip) return `ip:${request.ip}`;
    return 'anonymous';
  }
}
