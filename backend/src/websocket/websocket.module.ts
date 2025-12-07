import { Module } from '@nestjs/common';
import { JobsWebSocketGateway } from './websocket.gateway';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [JobsWebSocketGateway],
  exports: [JobsWebSocketGateway],
})
export class WebsocketModule {}
     