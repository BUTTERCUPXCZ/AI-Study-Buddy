import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { RedisService } from './redis/redis.service';

@Controller()
export class HealthController {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  root() {
    return {
      message: 'AI Study Buddy API',
      version: '1.0.0',
      status: 'running',
    };
  }

  // Liveness: is the process up? Used by orchestrators to decide whether to
  // restart the container. Must not depend on external services.
  @Get('health/live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  // Readiness: are we ready to serve traffic? Checks dependencies the request
  // path actually needs (Postgres, Redis). Used by load balancers to drain
  // an instance during a deploy or when a dependency degrades. Returns 503
  // when any dependency is unhealthy so the LB stops routing here.
  @Get('health/ready')
  async ready() {
    const [db, redis] = await Promise.all([this.checkDb(), this.redis.ping()]);
    const ok = db && redis;
    const body = {
      status: ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { db, redis },
    };
    if (!ok) {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return body;
  }

  // Legacy alias kept to avoid breaking the current Render healthCheckPath.
  // Prefer /health/live for liveness or /health/ready for readiness.
  @Get('health')
  legacy() {
    return this.live();
  }

  private async checkDb(): Promise<boolean> {
    try {
      await this.db.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
