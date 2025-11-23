import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JobsService } from '../jobs.service';

@Injectable()
export class CompletionQueue {
  private readonly logger = new Logger(CompletionQueue.name);

  constructor(
    @InjectQueue('completion') private completionQueue: Queue,
    private readonly jobsService: JobsService,
  ) {}

  async addCompletionJob(data: {
    jobId: string;
    userId?: string;
    result?: any;
  }) {
    const job = await this.completionQueue.add('finalize', data, {
      removeOnComplete: { age: 3600 },
      attempts: 2,
    });

    await this.jobsService.createJobRecord({
      jobId: job.id!,
      name: 'finalize',
      queueName: 'completion',
      data,
      userId: data.userId,
      opts: job.opts,
    });

    this.logger.log(`Completion job queued: ${job.id}`);
    return { jobId: job.id };
  }
}
