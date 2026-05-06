import { Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Request-scoped tracing fields we attach to req. Other middleware /
 * exception filters read `requestId` so log lines from different layers
 * correlate to a single click on the frontend.
 */
export interface RequestWithContext extends Request {
  requestId?: string;
  user?: { id?: string; email?: string; role?: string };
}

// Health probes hit every few seconds — skip them so the access log
// stays focused on real user actions.
const SKIP_PATHS = new Set(['/', '/health', '/health/live', '/health/ready']);

const logger = new Logger('HTTP');

/**
 * Express-style middleware that logs every API request once the response
 * is finalised. Status >= 500 logs as error, 400-499 as warn, else info.
 *
 * Sets `X-Request-Id` on the response and `req.requestId` so frontend
 * support can quote a single id when reporting a broken flow.
 */
export function requestLogger(
  req: RequestWithContext,
  res: Response,
  next: NextFunction,
): void {
  if (SKIP_PATHS.has(req.path)) {
    return next();
  }
  const requestId = randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const start = Date.now();
  // Snapshot before route handler — gives us "request received" visibility
  // even if a downstream guard hangs and the response never finishes.
  logger.log(
    `[${requestId}] -> ${req.method} ${req.originalUrl} ip=${req.ip ?? '-'}`,
  );

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const userId = req.user?.id ?? 'anon';
    const line = `[${requestId}] <- ${req.method} ${req.originalUrl} ${status} ${duration}ms user=${userId}`;
    if (status >= 500) logger.error(line);
    else if (status >= 400) logger.warn(line);
    else logger.log(line);
  });

  next();
}
