import { Module } from '@nestjs/common';
import { JobsWebSocketGateway } from './websocket.gateway';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [RedisModule, AuthModule, DatabaseModule],
  providers: [JobsWebSocketGateway],
  exports: [JobsWebSocketGateway],
})
export class WebsocketModule {}
