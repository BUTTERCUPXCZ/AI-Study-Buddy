import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { JobsWebSocketGateway } from './websocket.gateway';
import { WebSocketExampleService } from './websocket-example.service';

/**
 * Test controller for WebSocket functionality
 * Use these endpoints to test WebSocket real-time updates
 */
@Controller('websocket-test')
export class WebSocketTestController {
  constructor(
    private readonly wsGateway: JobsWebSocketGateway,
    private readonly exampleService: WebSocketExampleService,
  ) {}

  /**
   * Simulate a job with progress updates
   * GET /websocket-test/simulate-job/:jobId
   */
  @Get('simulate-job/:jobId')
  async simulateJob(@Param('jobId') jobId: string) {
    // Start the job simulation (non-blocking)
    this.exampleService.simulateJobExecution(jobId);
    
    return {
      message: 'Job simulation started',
      jobId,
      instructions: 'Connect to WebSocket and subscribe to this job ID to see real-time updates',
    };
  }

  /**
   * Send a test job update
   * POST /websocket-test/update/:jobId
   */
  @Post('update/:jobId')
  async sendUpdate(
    @Param('jobId') jobId: string,
    @Body() body: { status: string; data: any },
  ) {
    await this.wsGateway.emitJobUpdate(jobId, body.status, body.data);
    
    return {
      message: 'Update sent',
      jobId,
      status: body.status,
    };
  }

  /**
   * Send a test progress update
   * POST /websocket-test/progress/:jobId
   */
  @Post('progress/:jobId')
  async sendProgress(
    @Param('jobId') jobId: string,
    @Body() body: { progress: number; message?: string },
  ) {
    await this.wsGateway.emitJobProgress(jobId, body.progress, body.message);
    
    return {
      message: 'Progress update sent',
      jobId,
      progress: body.progress,
    };
  }

  /**
   * Send a job completion notification
   * POST /websocket-test/complete/:jobId
   */
  @Post('complete/:jobId')
  async completeJob(
    @Param('jobId') jobId: string,
    @Body() result: any,
  ) {
    await this.wsGateway.emitJobCompleted(jobId, result);
    
    return {
      message: 'Completion notification sent',
      jobId,
      result,
    };
  }

  /**
   * Send a job error notification
   * POST /websocket-test/error/:jobId
   */
  @Post('error/:jobId')
  async errorJob(
    @Param('jobId') jobId: string,
    @Body() body: { error: string },
  ) {
    await this.wsGateway.emitJobError(jobId, new Error(body.error));
    
    return {
      message: 'Error notification sent',
      jobId,
      error: body.error,
    };
  }

  /**
   * Get job history from Redis
   * GET /websocket-test/history/:jobId
   */
  @Get('history/:jobId')
  async getHistory(
    @Param('jobId') jobId: string,
  ) {
    const history = await this.wsGateway.getJobHistory(jobId, 20);
    
    return {
      jobId,
      count: history.length,
      history,
    };
  }

  /**
   * Broadcast a message to all connected clients
   * POST /websocket-test/broadcast
   */
  @Post('broadcast')
  async broadcast(@Body() body: { message: string }) {
    this.wsGateway.broadcastToAll('announcement', {
      message: body.message,
      timestamp: new Date().toISOString(),
    });
    
    return {
      message: 'Broadcast sent',
      content: body.message,
    };
  }

  /**
   * Send a notification to a specific user
   * POST /websocket-test/notify/:userId
   */
  @Post('notify/:userId')
  async notifyUser(
    @Param('userId') userId: string,
    @Body() notification: any,
  ) {
    this.wsGateway.emitToUser(userId, 'notification', notification);
    
    return {
      message: 'Notification sent',
      userId,
      notification,
    };
  }

  /**
   * Quick test endpoint - sends multiple updates in sequence
   * GET /websocket-test/quick-test/:jobId
   */
  @Get('quick-test/:jobId')
  async quickTest(@Param('jobId') jobId: string) {
    // Send a sequence of updates with delays
    setTimeout(async () => {
      await this.wsGateway.emitJobUpdate(jobId, 'started', { 
        message: 'Quick test started' 
      });
    }, 100);

    setTimeout(async () => {
      await this.wsGateway.emitJobProgress(jobId, 33, 'Processing step 1');
    }, 1000);

    setTimeout(async () => {
      await this.wsGateway.emitJobProgress(jobId, 66, 'Processing step 2');
    }, 2000);

    setTimeout(async () => {
      await this.wsGateway.emitJobProgress(jobId, 100, 'Finalizing');
    }, 3000);

    setTimeout(async () => {
      await this.wsGateway.emitJobCompleted(jobId, {
        message: 'Quick test completed successfully',
        duration: '3 seconds',
      });
    }, 4000);
    
    return {
      message: 'Quick test sequence started (will complete in ~4 seconds)',
      jobId,
      instructions: 'Subscribe to this job ID to see the updates',
    };
  }
}
