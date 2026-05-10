import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { AuditService } from './services/audit.service';
import { RedisThrottlerGuard } from './guards/redis-throttler.guard';
import { RedisService } from '../redis/redis.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    AuditService,
    {
      provide: RedisThrottlerGuard,
      useFactory: (reflector: Reflector, redisService: RedisService) => {
        return new RedisThrottlerGuard(reflector, redisService);
      },
      inject: [Reflector, RedisService],
    },
  ],
  exports: [AuditService, RedisThrottlerGuard],
})
export class CommonModule {}
