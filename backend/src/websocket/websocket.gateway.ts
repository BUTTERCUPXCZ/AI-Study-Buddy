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
// `cookie` ships without TS types; declare the small surface we use here
// rather than pulling in @types/cookie just for parse().
import { parse as parseCookieRaw } from 'cookie';
const parseCookie = parseCookieRaw as (
  raw: string,
) => Record<string, string | undefined>;
import { RedisService } from '../redis/redis.service';
import { AuthService } from '../auth/auth.service';
import { DatabaseService } from '../database/database.service';

interface AuthenticatedSocketData {
  userId?: string;
}

// S9 — WebSocket abuse limits.
const WS_MAX_BUFFER_BYTES = 64 * 1024; // 64 KB — bigger than any legit job payload
const WS_RATE_LIMIT_PER_SEC = 30; // messages/second per connection
const WS_MAX_CONNS_PER_USER = 5; // sockets per user

@WSGateway({
  cors: {
    // Restrict to the configured frontend; never wildcard with credentials.
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  namespace: '/jobs',
  // S9 — cap a single WS frame so an abuser can't OOM the worker.
  maxHttpBufferSize: WS_MAX_BUFFER_BYTES,
})
export class JobsWebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('JobsWebSocketGateway');

  constructor(
    private readonly redisService: RedisService,
    private readonly authService: AuthService,
    private readonly databaseService: DatabaseService,
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');

    // Authenticate every socket using the access_token cookie sent during
    // the handshake. This runs before handleConnection. Reject the
    // handshake if no valid token is present.
    this.server.use((socket, next) => {
      const authenticate = async (): Promise<void> => {
        const rawCookie = socket.handshake.headers?.cookie ?? '';
        const parsed = parseCookie(rawCookie);
        const token = parsed['access_token'];
        if (!token) {
          throw new Error('Authentication required');
        }
        const user = await this.authService.verifyToken(token);
        if (!user?.id) {
          throw new Error('Invalid token');
        }
        const data = socket.data as AuthenticatedSocketData;
        data.userId = user.id;

        // S9 — concurrent-connection cap per user. Refuse the handshake
        // when this user already has WS_MAX_CONNS_PER_USER live sockets.
        // The set is cleaned on disconnect; in the worst case stale entries
        // are removed by the 1-day TTL we apply on add.
        try {
          const setKey = `ws:conns:${user.id}`;
          await this.redisService.sadd(setKey, socket.id);
          await this.redisService.expire(setKey, 24 * 60 * 60);
          const members = await this.redisService.smembers(setKey);
          if (members.length > WS_MAX_CONNS_PER_USER) {
            await this.redisService.srem(setKey, socket.id);
            throw new Error('Too many concurrent sessions');
          }
        } catch (err) {
          if (
            err instanceof Error &&
            err.message === 'Too many concurrent sessions'
          ) {
            throw err;
          }
          // Redis blip — fail-open so legitimate users aren't blocked by
          // a transient outage. Logged so the spike is visible.
          this.logger.warn(
            `WS conn-cap probe failed (allowing): ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        }
      };

      authenticate()
        .then(() => next())
        .catch((err: unknown) => {
          this.logger.warn(
            `WS auth failed: ${err instanceof Error ? err.message : 'unknown'}`,
          );
          next(new Error('Authentication failed'));
        });
    });
  }

  handleConnection(client: Socket) {
    const data = client.data as AuthenticatedSocketData;
    const userId = data.userId;
    this.logger.log(`Client connected: ${client.id} (user ${userId ?? '?'})`);

    // Auto-join the client to its own user-room. The server is the only
    // source of truth for which user this socket belongs to.
    if (userId) {
      void client.join(`user:${userId}`);
    }

    // S9 — per-connection rate limit. Each inbound packet increments a
    // 1-second Redis counter; when it crosses WS_RATE_LIMIT_PER_SEC we
    // disconnect the offending socket. Real users sit at <1 msg/sec so
    // this only catches automation.
    if (userId) {
      client.use((_packet, next) => {
        const key = `ws:msg:${userId}:${client.id}`;
        this.redisService
          .incr(key)
          .then(async (count) => {
            if (count === 1) {
              await this.redisService.expire(key, 1);
            }
            if (count > WS_RATE_LIMIT_PER_SEC) {
              this.logger.warn(
                `WS rate limit exceeded for user ${userId} on ${client.id} (${count} msg/sec)`,
              );
              client.disconnect(true);
              return;
            }
            next();
          })
          .catch(() => next());
      });
    }

    this.storeClientConnection(client.id, {
      connectedAt: new Date().toISOString(),
      userId,
    }).catch((err) =>
      this.logger.error(
        `Failed to store client connection: ${(err as Error).message}`,
      ),
    );
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    await this.removeClientConnection(client.id);
    // S9 — release this socket's slot in the per-user concurrent-connection
    // set so the user can reconnect cleanly.
    const data = client.data as AuthenticatedSocketData;
    if (data.userId) {
      try {
        await this.redisService.srem(`ws:conns:${data.userId}`, client.id);
      } catch {
        /* best-effort */
      }
    }
  }

  /**
   * Subscribe a client to job updates. The client may pass `jobId` only;
   * any client-supplied `userId` is ignored and the server uses the
   * authenticated user from the cookie.
   */
  @SubscribeMessage('subscribe:jobs')
  async handleSubscribeToJobs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId?: string } | undefined,
  ) {
    const sd = client.data as AuthenticatedSocketData;
    const userId = sd.userId;
    if (!userId) {
      return { success: false, message: 'Not authenticated' };
    }

    // For job-specific subscriptions, verify the user owns the job
    // before joining the room.
    if (data?.jobId) {
      const owned = await this.userOwnsJob(userId, data.jobId);
      if (!owned) {
        this.logger.warn(
          `User ${userId} attempted to subscribe to non-owned job ${data.jobId}`,
        );
        return { success: false, message: 'Forbidden' };
      }
      const room = `job:${data.jobId}`;
      void client.join(room);

      void this.redisService
        .sadd(`subscriptions:${client.id}`, room)
        .catch((err) =>
          this.logger.error(
            `Failed to store subscription: ${(err as Error).message}`,
          ),
        );

      const cachedProgress = await this.getJobProgress(data.jobId);
      if (cachedProgress) {
        client.emit('job:progress', cachedProgress);
      }
      return { success: true, room, message: 'Subscribed to job updates' };
    }

    // Otherwise the user-room is already joined on connect; nothing to do.
    return {
      success: true,
      room: `user:${userId}`,
      message: 'Already subscribed to user updates',
    };
  }

  @SubscribeMessage('unsubscribe:jobs')
  handleUnsubscribeFromJobs(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { jobId?: string } | undefined,
  ) {
    if (data?.jobId) {
      const room = `job:${data.jobId}`;
      void client.leave(room);
      void this.redisService
        .srem(`subscriptions:${client.id}`, room)
        .catch((err) =>
          this.logger.error(
            `Failed to remove subscription: ${(err as Error).message}`,
          ),
        );
      return { success: true, room };
    }
    return { success: true };
  }

  emitJobUpdate(
    jobId: string,
    status: string,
    payload: {
      userId: string;
      jobId: string;
      progress: number;
      message: string;
      fileId?: string;
      noteId?: string;
    },
  ) {
    const userRoom = `user:${payload.userId}`;
    const jobRoom = `job:${payload.jobId}`;

    const updateData = {
      jobId: payload.jobId,
      progress: payload.progress,
      status,
      message: payload.message,
      timestamp: new Date().toISOString(),
    };

    void this.cacheJobProgress(jobId, updateData);

    this.server.to(userRoom).emit('job:progress', updateData);
    this.server.to(jobRoom).emit('job:progress', updateData);
  }

  async emitJobCompleted(jobId: string, result: unknown) {
    const payload = {
      jobId,
      status: 'completed',
      result,
      timestamp: new Date().toISOString(),
    };

    await this.storeJobUpdate(jobId, payload);

    this.server.to(`job:${jobId}`).emit('job:completed', payload);

    if (result && typeof result === 'object' && 'userId' in result) {
      const userId = (result as { userId?: string }).userId;
      if (userId) {
        this.server.to(`user:${userId}`).emit('job:completed', payload);
      }
    }
  }

  async emitJobError(jobId: string, error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const payload = {
      jobId,
      status: 'failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    await this.storeJobUpdate(jobId, payload);

    this.server.to(`job:${jobId}`).emit('job:error', payload);

    if (error && typeof error === 'object' && 'userId' in error) {
      const userId = (error as { userId?: string }).userId;
      if (userId) {
        this.server.to(`user:${userId}`).emit('job:error', payload);
      }
    }
  }

  emitJobProgress(
    jobId: string,
    progress: number,
    message?: string,
    userId?: string,
  ) {
    const payload = {
      jobId,
      status: 'in_progress',
      progress,
      message,
      timestamp: new Date().toISOString(),
    };

    void this.cacheJobProgress(jobId, payload);

    this.server.to(`job:${jobId}`).emit('job:progress', payload);

    if (userId) {
      this.server.to(`user:${userId}`).emit('job:progress', payload);
    }
  }

  /**
   * Streams a partial AI-generated content chunk to the user. Used by
   * the notes worker so the UI can render text as it generates
   * (ChatGPT-style typing). Not cached — these arrive at high
   * frequency and are transient by design.
   */
  emitJobNotesChunk(
    jobId: string,
    chunk: string,
    accumulated: string,
    userId?: string,
  ) {
    const payload = {
      jobId,
      chunk,
      accumulated,
      timestamp: new Date().toISOString(),
    };

    this.server.to(`job:${jobId}`).emit('job:notes:chunk', payload);

    if (userId) {
      this.server.to(`user:${userId}`).emit('job:notes:chunk', payload);
    }
  }

  // ---------- Helpers ----------

  private async userOwnsJob(userId: string, jobId: string): Promise<boolean> {
    try {
      const job = await this.databaseService.job.findUnique({
        where: { jobId },
        select: { userId: true },
      });
      if (!job) return false;
      // If the job has no userId attached (legacy rows), permit access; new
      // rows always have a userId, so this is a one-way migration.
      return !job.userId || job.userId === userId;
    } catch {
      return false;
    }
  }

  private async storeClientConnection(clientId: string, data: any) {
    try {
      await this.redisService.hset(
        `client:${clientId}`,
        'connection',
        JSON.stringify(data),
      );
      await this.redisService.expire(`client:${clientId}`, 3600);
    } catch (error) {
      this.logger.error(
        `Failed to store client connection: ${(error as Error).message}`,
      );
    }
  }

  private async removeClientConnection(clientId: string) {
    try {
      await this.redisService.del(
        `client:${clientId}`,
        `subscriptions:${clientId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove client connection: ${(error as Error).message}`,
      );
    }
  }

  private async storeJobUpdate(jobId: string, payload: any) {
    try {
      const key = `job-history:${jobId}`;
      await this.redisService.lpush(key, JSON.stringify(payload));
      await this.redisService.ltrim(key, 0, 99);
      await this.redisService.expire(key, 86400);
    } catch (error) {
      this.logger.error(
        `Failed to store job update: ${(error as Error).message}`,
      );
    }
  }

  async getJobHistory(jobId: string, limit: number = 10) {
    try {
      const key = `job-history:${jobId}`;
      const history = await this.redisService.lrange(key, 0, limit - 1);
      return history.map((item) => JSON.parse(item) as unknown);
    } catch (error) {
      this.logger.error(
        `Failed to get job history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  private async cacheJobProgress(jobId: string, payload: any) {
    try {
      const key = `job-progress:${jobId}`;
      await this.redisService.set(key, JSON.stringify(payload), 600);
    } catch (error) {
      this.logger.error(
        `Failed to cache job progress: ${(error as Error).message}`,
      );
    }
  }

  private async getJobProgress(
    jobId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const key = `job-progress:${jobId}`;
      const cached = await this.redisService.get(key);
      if (cached) {
        return JSON.parse(cached) as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
