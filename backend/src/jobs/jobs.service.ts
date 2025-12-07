import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Job, JobStatus } from '@prisma/client';

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
  }): Promise<Job> {
    // Use upsert to avoid unique constraint errors
    const result = await this.databaseService.job.upsert({
      where: { jobId: data.jobId },
      update: {
        name: data.name,
        queueName: data.queueName,
        data: data.data,
        opts: data.opts || {},
        status: 'waiting' as JobStatus,
        userId: data.userId,
      },
      create: {
        jobId: data.jobId,
        name: data.name,
        queueName: data.queueName,
        data: data.data,
        opts: data.opts || {},
        status: 'waiting' as JobStatus,
        userId: data.userId,
      },
    });
    return result;
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
  ): Promise<Job> {
    const result = await this.databaseService.job.update({
      where: { jobId },
      data: {
        status,
        ...extraData,
        updatedAt: new Date(),
      },
    });
    return result;
  }

  /**
   * Get job by jobId
   */
  async getJob(jobId: string): Promise<Job | null> {
    const result = await this.databaseService.job.findUnique({
      where: { jobId },
    });
    return result;
  }

  /**
   * Get jobs by user
   */
  async getUserJobs(userId: string, limit = 50): Promise<Job[]> {
    const result = await this.databaseService.job.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return result;
  }

  /**
   * Get jobs by queue name
   */
  async getQueueJobs(queueName: string, limit = 50): Promise<Job[]> {
    const result = await this.databaseService.job.findMany({
      where: { queueName },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return result;
  }

  /**
   * Clean up completed jobs older than specified days
   */
  async cleanupOldJobs(days: number = 7): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.databaseService.job.deleteMany({
      where: {
        status: 'completed' as JobStatus,
        finishedAt: {
          lt: cutoffDate,
        },
      },
    });
    return { count: result.count };
  }

  /**
   * Set a human-friendly stage for a job (stored in opts JSON)
   * This avoids risky schema migrations while still tracking fine-grained stages.
   */
  async setJobStage(jobId: string, stage: string): Promise<Job> {
    // Read current job opts
    const existingJob = await this.databaseService.job.findUnique({
      where: { jobId },
    });
    const currentOpts =
      (existingJob &&
      typeof existingJob.opts === 'object' &&
      existingJob.opts !== null
        ? (existingJob.opts as Record<string, any>)
        : {}) || {};
    const newOpts = { ...currentOpts, stage } as Record<string, any>;

    const result = await this.databaseService.job.update({
      where: { jobId },
      data: {
        opts: newOpts,
        updatedAt: new Date(),
      },
    });
    return result;
  }

  /**
   * Upsert job status - creates record if it doesn't exist, updates if it does
   * This is a fallback for cases where the job record wasn't created before the worker started
   */
  async upsertJobStatus(
    jobId: string,
    status: JobStatus,
    extraData?: {
      progress?: number;
      failedReason?: string;
      finishedAt?: Date;
      failedAt?: Date;
      attempts?: number;
      name?: string;
      queueName?: string;
      data?: Record<string, any>;
      userId?: string;
    },
  ): Promise<Job> {
    const result = await this.databaseService.job.upsert({
      where: { jobId },
      update: {
        status,
        progress: extraData?.progress,
        failedReason: extraData?.failedReason,
        finishedAt: extraData?.finishedAt,
        failedAt: extraData?.failedAt,
        attempts: extraData?.attempts,
        updatedAt: new Date(),
      },
      create: {
        jobId,
        name: extraData?.name || 'unknown',
        queueName: extraData?.queueName || 'pdf-notes-optimized',
        data: extraData?.data || {},
        opts: {},
        status,
        progress: extraData?.progress,
        userId: extraData?.userId,
      },
    });
    return result;
  }
}
