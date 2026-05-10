import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';

/**
 * Returns a JSON snapshot the admin dashboard polls every few seconds.
 * Pulls from existing facilities (RedisService, BullMQ queues, Prisma)
 * — no new instrumentation required.
 */
@Injectable()
export class AdminMetricsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    @InjectQueue('pdf-extract') private readonly pdfExtract: Queue,
    @InjectQueue('ai-notes') private readonly aiNotes: Queue,
    @InjectQueue('ai-quiz') private readonly aiQuiz: Queue,
    @InjectQueue('completion') private readonly completion: Queue,
    @InjectQueue('pdf-ultra-optimized') private readonly pdfUltra: Queue,
  ) {}

  async snapshot() {
    const startedAt = Date.now();
    const [redisOk, dbMs, queues] = await Promise.all([
      this.pingRedis(),
      this.pingDb(),
      this.queueCounts(),
    ]);
    const mem = process.memoryUsage();
    return {
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      },
      redis: { ok: redisOk },
      db: { ok: dbMs >= 0, latencyMs: dbMs },
      queues,
      generatedInMs: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    };
  }

  private async pingRedis(): Promise<boolean> {
    try {
      return await this.redis.ping();
    } catch {
      return false;
    }
  }

  private async pingDb(): Promise<number> {
    const t = Date.now();
    try {
      await this.db.$queryRaw`SELECT 1`;
      return Date.now() - t;
    } catch {
      return -1;
    }
  }

  private async queueCounts() {
    const queues: Record<string, Queue> = {
      'pdf-extract': this.pdfExtract,
      'ai-notes': this.aiNotes,
      'ai-quiz': this.aiQuiz,
      'completion': this.completion,
      'pdf-ultra-optimized': this.pdfUltra,
    };
    const out: Record<string, unknown> = {};
    await Promise.all(
      Object.entries(queues).map(async ([name, q]) => {
        try {
          const c = await q.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
          );
          out[name] = c;
        } catch (err) {
          out[name] = {
            error: err instanceof Error ? err.message : 'unknown',
          };
        }
      }),
    );
    return out;
  }
}
