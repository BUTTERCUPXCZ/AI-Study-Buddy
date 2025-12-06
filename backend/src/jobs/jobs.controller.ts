import { Controller, Get, Param, Query, Delete } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { PdfUltraOptimizedQueue } from './queues/pdf-ultra-optimized.queue';

@Controller('jobs')
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly ultraOptimizedQueue: PdfUltraOptimizedQueue,
  ) {}

  /**
   * Get a specific job by jobId
   * GET /jobs/:jobId
   */
  @Get(':jobId')
  async getJob(@Param('jobId') jobId: string) {
    const job = await this.jobsService.getJob(jobId);
    return {
      success: true,
      job,
    };
  }

  /**
   * Get jobs for a specific user
   * GET /jobs/user/:userId
   */
  @Get('user/:userId')
  async getUserJobs(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const jobs = await this.jobsService.getUserJobs(
      userId,
      limit ? parseInt(limit, 10) : 50,
    );
    return {
      success: true,
      count: jobs.length,
      jobs,
    };
  }

  /**
   * Get jobs for a specific queue
   * GET /jobs/queue/:queueName
   */
  @Get('queue/:queueName')
  async getQueueJobs(
    @Param('queueName') queueName: string,
    @Query('limit') limit?: string,
  ) {
    const jobs = await this.jobsService.getQueueJobs(
      queueName,
      limit ? parseInt(limit, 10) : 50,
    );
    return {
      success: true,
      count: jobs.length,
      jobs,
    };
  }

  /**
   * Clean up old completed jobs
   * DELETE /jobs/cleanup
   */
  @Delete('cleanup')
  async cleanupJobs(@Query('days') days?: string) {
    const result = await this.jobsService.cleanupOldJobs(
      days ? parseInt(days, 10) : 7,
    );
    return {
      success: true,
      message: `Cleaned up ${result.count} old jobs`,
      count: result.count,
    };
  }

  /**
   * Get ultra-optimized queue metrics
   * GET /jobs/ultra-optimized/metrics
   */
  @Get('ultra-optimized/metrics')
  async getUltraOptimizedMetrics() {
    const metrics = await this.ultraOptimizedQueue.getQueueMetrics();
    return {
      success: true,
      metrics,
    };
  }

  /**
   * Get ultra-optimized job status
   * GET /jobs/ultra-optimized/:jobId
   */
  @Get('ultra-optimized/:jobId')
  async getUltraOptimizedJob(@Param('jobId') jobId: string) {
    const job = await this.ultraOptimizedQueue.getJobStatus(jobId);
    return {
      success: true,
      job,
    };
  }
}
