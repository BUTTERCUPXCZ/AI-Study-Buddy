import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateAiQuizJobDto } from '../dto/ai-quiz.dto';
import { JobsService } from '../jobs.service';

@Injectable()
export class AiQuizQueue {
  private readonly logger = new Logger(AiQuizQueue.name);

  constructor(
    @InjectQueue('ai-quiz') private aiQuizQueue: Queue<CreateAiQuizJobDto>,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * Add an AI quiz generation job to the queue
   * This is called after AI notes generation is complete
   */
  async addAiQuizJob(data: CreateAiQuizJobDto) {
    try {
      this.logger.log(
        `Adding AI quiz generation job for note: ${data.noteTitle}`,
      );

      // Add job to BullMQ queue
      const job = await this.aiQuizQueue.add(
        'generate-quiz',
        {
          noteId: data.noteId,
          noteContent: data.noteContent,
          noteTitle: data.noteTitle,
          userId: data.userId,
          aiNotesJobId: data.aiNotesJobId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: {
            age: 3600,
            count: 100,
          },
          removeOnFail: {
            age: 86400,
          },
        },
      );

      this.logger.log(`AI quiz job added with ID: ${job.id}`);

      // Save job metadata to database
      await this.jobsService.createJobRecord({
        jobId: job.id!,
        name: 'generate-quiz',
        queueName: 'ai-quiz',
        data: {
          noteId: data.noteId,
          noteTitle: data.noteTitle,
        },
        userId: data.userId,
        opts: job.opts,
      });

      return {
        jobId: job.id,
        message: 'AI quiz generation job queued successfully',
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add AI quiz job: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get job status from BullMQ
   */
  async getJobStatus(jobId: string) {
    const job = await this.aiQuizQueue.getJob(jobId);

    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      jobId: job.id,
      name: job.name,
      data: job.data,
      state,
      progress,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    };
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.aiQuizQueue.getWaitingCount(),
      this.aiQuizQueue.getActiveCount(),
      this.aiQuizQueue.getCompletedCount(),
      this.aiQuizQueue.getFailedCount(),
      this.aiQuizQueue.getDelayedCount(),
    ]);

    return {
      queue: 'ai-quiz',
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed,
      },
    };
  }
}
