import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisTestController } from './redis-test.controller';
import { RedisThrottlerStorage } from '../common/storage/redis-throttler.storage';

@Global()
@Module({
  controllers: [RedisTestController],
  providers: [RedisService, RedisThrottlerStorage],
  exports: [RedisService, RedisThrottlerStorage],
})
export class RedisModule {}
