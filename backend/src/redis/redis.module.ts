import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisTestController } from './redis-test.controller';

const isProd = process.env.NODE_ENV === 'production';
const controllers = isProd ? [] : [RedisTestController];

@Global()
@Module({
  controllers,
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
