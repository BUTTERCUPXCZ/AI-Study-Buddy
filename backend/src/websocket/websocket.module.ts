import { Module } from '@nestjs/common';
import { JobsWebSocketGateway } from './websocket.gateway';
import { WebSocketExampleService } from './websocket-example.service';
import { WebSocketTestController } from './websocket-test.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  controllers: [WebSocketTestController],
  providers: [JobsWebSocketGateway, WebSocketExampleService],
  exports: [JobsWebSocketGateway],
})
export class WebsocketModule {}
