import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@WSGateway({
  cors: {
    origin: '*', // Configure this based on your frontend URL
    credentials: true,
  },
  namespace: '/jobs', // Namespace for job updates
})
export class JobsWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('JobsWebSocketGateway');
  private readonly JOB_UPDATES_CHANNEL = 'job-updates';

  constructor(private readonly redisService: RedisService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // Store client connection info in Redis
    this.storeClientConnection(client.id, {
      connectedAt: new Date().toISOString(),
      address: client.handshake.address,
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Remove client connection info from Redis
    await this.removeClientConnection(client.id);
  }

  /**
   * Subscribe a client to job updates
   */
  @SubscribeMessage('subscribe:jobs')
  async handleSubscribeToJobs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string; jobId?: string },
  ) {
    const room = data.jobId ? `job:${data.jobId}` : data.userId ? `user:${data.userId}` : 'all-jobs';
    client.join(room);
    this.logger.log(`Client ${client.id} subscribed to ${room}`);

    // Store subscription in Redis
    await this.redisService.sadd(`subscriptions:${client.id}`, room);

    return { success: true, room, message: 'Subscribed to job updates' };
  }

  /**
   * Unsubscribe from job updates
   */
  @SubscribeMessage('unsubscribe:jobs')
  async handleUnsubscribeFromJobs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId?: string; jobId?: string },
  ) {
    const room = data.jobId ? `job:${data.jobId}` : data.userId ? `user:${data.userId}` : 'all-jobs';
    client.leave(room);
    this.logger.log(`Client ${client.id} unsubscribed from ${room}`);

    // Remove subscription from Redis
    await this.redisService.srem(`subscriptions:${client.id}`, room);

    return { success: true, room, message: 'Unsubscribed from job updates' };
  }

  /**
   * Emit job status update to subscribed clients
   */
  async emitJobUpdate(jobId: string, status: string, payload: any) {
    const userRoom = `user:${payload.userId}`;
    const jobRoom = `job:${payload.jobId}`;
    
    const updateData = {
      jobId: payload.jobId,
      progress: payload.progress,
      status,
      message: payload.message,
      timestamp: new Date().toISOString(),
    };

    // Emit to both user room and job-specific room
    this.server.to(userRoom).emit('job:progress', updateData);
    this.server.to(jobRoom).emit('job:progress', updateData);
    
    this.logger.log(`Job update emitted for job ${jobId} to ${userRoom} and ${jobRoom}`);
  }

  /**
   * Emit job completion
   */
  async emitJobCompleted(jobId: string, result: any) {
    const payload = {
      jobId,
      status: 'completed',
      result,
      timestamp: new Date().toISOString(),
    };

    await this.storeJobUpdate(jobId, payload);
    this.server.to(`job:${jobId}`).emit('job:completed', payload);
    this.server.to('all-jobs').emit('job:completed', payload);

    this.logger.log(`Job completed notification sent for job ${jobId}`);
  }

  /**
   * Emit job error
   */
  async emitJobError(jobId: string, error: any) {
    const payload = {
      jobId,
      status: 'failed',
      error: error.message || error,
      timestamp: new Date().toISOString(),
    };

    await this.storeJobUpdate(jobId, payload);
    this.server.to(`job:${jobId}`).emit('job:error', payload);
    this.server.to('all-jobs').emit('job:error', payload);

    this.logger.error(`Job error notification sent for job ${jobId}`, error);
  }

  /**
   * Emit job progress update
   */
  async emitJobProgress(jobId: string, progress: number, message?: string) {
    const payload = {
      jobId,
      status: 'in_progress',
      progress,
      message,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`job:${jobId}`).emit('job:progress', payload);

    this.logger.log(`Job progress update for job ${jobId}: ${progress}%`);
  }

  // Redis helper methods

  private async storeClientConnection(clientId: string, data: any) {
    try {
      await this.redisService.hset(
        `client:${clientId}`,
        'connection',
        JSON.stringify(data),
      );
      await this.redisService.expire(`client:${clientId}`, 3600); // 1 hour expiry
    } catch (error) {
      this.logger.error(`Failed to store client connection: ${error.message}`);
    }
  }

  private async removeClientConnection(clientId: string) {
    try {
      await this.redisService.del(`client:${clientId}`, `subscriptions:${clientId}`);
    } catch (error) {
      this.logger.error(`Failed to remove client connection: ${error.message}`);
    }
  }

  private async storeJobUpdate(jobId: string, payload: any) {
    try {
      const key = `job-history:${jobId}`;
      await this.redisService.lpush(key, JSON.stringify(payload));
      // Keep only last 100 updates
      await this.redisService.ltrim(key, 0, 99);
      // Set expiry to 24 hours
      await this.redisService.expire(key, 86400);
    } catch (error) {
      this.logger.error(`Failed to store job update: ${error.message}`);
    }
  }

  /**
   * Get job history from Redis
   */
  async getJobHistory(jobId: string, limit: number = 10) {
    try {
      const key = `job-history:${jobId}`;
      const history = await this.redisService.lrange(key, 0, limit - 1);
      return history.map((item) => JSON.parse(item));
    } catch (error) {
      this.logger.error(`Failed to get job history: ${error.message}`);
      return [];
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.log(`Broadcast message: ${event}`);
  }

  /**
   * Send message to specific user
   */
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
    this.logger.log(`Message sent to user ${userId}: ${event}`);
  }
}
