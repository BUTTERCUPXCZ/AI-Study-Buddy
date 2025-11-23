import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JobStatus } from '@prisma/client';

@Injectable()
export class JobsService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Create a job record in the database
   */
  async createJobRecord(data: {
    jobId: string;
    name: string;
    queueName: string;
    data: Record<string, any>;
    userId?: string;
    opts?: Record<string, any>;
  }) {
    // Use upsert to avoid unique constraint errors
    return await this.databaseService.job.upsert({
      where: { jobId: data.jobId },
      update: {
        name: data.name,
        queueName: data.queueName,
        data: data.data,
        opts: data.opts || {},
        status: JobStatus.waiting,
        userId: data.userId,
      },
      create: {
        jobId: data.jobId,
        name: data.name,
        queueName: data.queueName,
        data: data.data,
        opts: data.opts || {},
        status: JobStatus.waiting,
        userId: data.userId,
      },
    });
  }

  /**
   * Update job status in the database
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    extraData?: {
      progress?: number;
      failedReason?: string;
      finishedAt?: Date;
      failedAt?: Date;
      attempts?: number;
    },
  ) {
    return await this.databaseService.job.update({
      where: { jobId },
      data: {
        status,
        ...extraData,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Get job by jobId
   */
  async getJob(jobId: string) {
    return await this.databaseService.job.findUnique({
      where: { jobId },
    });
  }

  /**
   * Get jobs by user
   */
  async getUserJobs(userId: string, limit = 50) {
    return await this.databaseService.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get jobs by queue name
   */
  async getQueueJobs(queueName: string, limit = 50) {
    return await this.databaseService.job.findMany({
      where: { queueName },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Clean up completed jobs older than specified days
   */
  async cleanupOldJobs(days: number = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.databaseService.job.deleteMany({
      where: {
        status: JobStatus.completed,
        finishedAt: {
          lt: cutoffDate,
        },
      },
    });
  }

  /**
   * Set a human-friendly stage for a job (stored in opts JSON)
   * This avoids risky schema migrations while still tracking fine-grained stages.
   */
  async setJobStage(jobId: string, stage: string) {
    // Read current job opts
    const job = await this.databaseService.job.findUnique({ where: { jobId } });
    const currentOpts = (job && (job.opts as Record<string, any>)) || {};
    const newOpts = { ...currentOpts, stage };

    return await this.databaseService.job.update({
      where: { jobId },
      data: {
        opts: newOpts,
        updatedAt: new Date(),
      },
    });
  }
}
