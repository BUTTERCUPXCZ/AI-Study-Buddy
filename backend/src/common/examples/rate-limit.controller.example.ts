import { Controller, Get, Post } from '@nestjs/common';
import { Throttle, SkipThrottle } from '../decorators/throttle.decorator';

@Controller('example')
export class ExampleController {
  // Uses default rate limit from app.module.ts
  @Get('default')
  getWithDefaultLimit() {
    return { message: 'This endpoint uses default rate limiting' };
  }

  // Custom rate limit: 5 requests per 60 seconds
  @Throttle(5, 60)
  @Get('strict')
  getWithStrictLimit() {
    return { message: 'This endpoint allows only 5 requests per minute' };
  }

  // Custom rate limit: 100 requests per 60 seconds
  @Throttle(100, 60)
  @Post('relaxed')
  postWithRelaxedLimit() {
    return { message: 'This endpoint allows 100 requests per minute' };
  }

  // Skip rate limiting entirely
  @SkipThrottle()
  @Get('public')
  getPublicEndpoint() {
    return { message: 'This endpoint has no rate limiting' };
  }

  // Very strict rate limit for expensive operations
  @Throttle(1, 10)
  @Post('expensive')
  expensiveOperation() {
    return { message: 'This endpoint allows only 1 request per 10 seconds' };
  }
}
