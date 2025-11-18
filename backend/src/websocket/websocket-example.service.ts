import { Injectable } from '@nestjs/common';
import { JobsWebSocketGateway } from './websocket.gateway';

/**
 * Example service demonstrating how to use the WebSocket gateway
 * for emitting real-time job updates
 */
@Injectable()
export class WebSocketExampleService {
  constructor(private readonly wsGateway: JobsWebSocketGateway) {}

  /**
   * Example: Simulate a long-running job with progress updates
   */
  async simulateJobExecution(jobId: string): Promise<void> {
    try {
      // Emit job started
      await this.wsGateway.emitJobUpdate(jobId, 'started', {
        message: 'Job execution started',
        startTime: new Date().toISOString(),
      });

      // Step 1: Initialize (25%)
      await this.sleep(1000);
      await this.wsGateway.emitJobProgress(jobId, 25, 'Initializing job');

      // Step 2: Processing data (50%)
      await this.sleep(1000);
      await this.wsGateway.emitJobProgress(jobId, 50, 'Processing data');

      // Step 3: Analyzing results (75%)
      await this.sleep(1000);
      await this.wsGateway.emitJobProgress(jobId, 75, 'Analyzing results');

      // Step 4: Finalizing (100%)
      await this.sleep(1000);
      await this.wsGateway.emitJobProgress(jobId, 100, 'Finalizing');

      // Emit completion
      await this.wsGateway.emitJobCompleted(jobId, {
        status: 'success',
        message: 'Job completed successfully',
        result: {
          itemsProcessed: 100,
          duration: '4 seconds',
        },
      });
    } catch (error) {
      // Emit error if something goes wrong
      await this.wsGateway.emitJobError(jobId, error);
    }
  }

  /**
   * Example: Handle multiple jobs with different statuses
   */
  async handleBatchJobs(jobIds: string[]): Promise<void> {
    for (const jobId of jobIds) {
      // Process each job (could be done in parallel)
      await this.simulateJobExecution(jobId);
    }
  }

  /**
   * Example: Get job history
   */
  async getJobHistory(jobId: string) {
    return await this.wsGateway.getJobHistory(jobId, 10);
  }

  /**
   * Example: Broadcast announcement to all users
   */
  async broadcastAnnouncement(message: string) {
    this.wsGateway.broadcastToAll('announcement', {
      message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Example: Send notification to specific user
   */
  async notifyUser(userId: string, notification: any) {
    this.wsGateway.emitToUser(userId, 'notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
