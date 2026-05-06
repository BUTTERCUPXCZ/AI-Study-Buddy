import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { PdfUltraOptimizedQueue } from './queues/pdf-ultra-optimized.queue';
import { AuthGuard } from '../auth/auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('jobs')
@UseGuards(AuthGuard, EmailVerifiedGuard)
export class JobsController {
  constructor(
    private readonly jobsService: JobsService,
    private readonly ultraOptimizedQueue: PdfUltraOptimizedQueue,
  ) {}

  /**
   * Get a specific job by jobId — must be owned by the requesting user
   */
  @Get(':jobId')
  async getJob(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ) {
    const job = await this.jobsService.getJob(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    const ownerId = (job as { userId?: string | null }).userId;
    if (ownerId && ownerId !== userId) {
      throw new ForbiddenException('Not your job');
    }
    return {
      success: true,
      job,
    };
  }

  /**
   * Get jobs for the current user
   */
  @Get('user/me')
  async getUserJobs(
    @CurrentUser('id') userId: string,
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
   * Get ultra-optimized job status — must be owned by the requesting user
   */
  @Get('ultra-optimized/:jobId')
  async getUltraOptimizedJob(
    @CurrentUser('id') userId: string,
    @Param('jobId') jobId: string,
  ) {
    const job = await this.ultraOptimizedQueue.getJobStatus(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    const ownerId = (job as { userId?: string | null }).userId;
    if (ownerId && ownerId !== userId) {
      throw new ForbiddenException('Not your job');
    }
    return {
      success: true,
      job,
    };
  }
}
