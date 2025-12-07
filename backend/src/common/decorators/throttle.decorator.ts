import { SetMetadata } from '@nestjs/common';

export const THROTTLE_KEY = 'throttle';

export interface ThrottleOptions {
  limit: number;
  ttl: number;
  skipIf?: (context: any) => boolean;
}

/**
 * Custom throttle decorator with enhanced options
 * @param limit - Maximum number of requests
 * @param ttl - Time to live in seconds
 */
export const Throttle = (limit: number, ttl: number) =>
  SetMetadata(THROTTLE_KEY, { limit, ttl });

/**
 * Skip rate limiting for specific conditions
 */
export const SkipThrottle = () => SetMetadata(THROTTLE_KEY, { skip: true });
