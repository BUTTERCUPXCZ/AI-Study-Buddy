import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';

interface RequestWithId extends Request {
  requestId?: string;
}

/**
 * Catch-all exception filter. Three jobs:
 *
 *  1. Forward `HttpException`s as-is — they're intentional errors with
 *     meaningful status codes and bodies the framework already shaped.
 *     Log them at warn so operators can see 4xx noise without grepping.
 *  2. Convert anything else to a generic 500 with a stable `requestId`.
 *     The full stack trace is logged server-side; the response body
 *     contains the requestId so the user can quote it in support and
 *     operators can grep logs without leaking implementation detail.
 *  3. Reuse the requestId attached by `requestLogger` middleware when
 *     present so all layers correlate to a single id.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const requestId = request.requestId ?? randomUUID();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: unknown }).message ?? exception.message);
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} -> ${status} ${
          typeof message === 'string' ? message : JSON.stringify(message)
        }`,
      );
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body, requestId }
            : { ...body, requestId },
        );
      return;
    }

    const message =
      exception instanceof Error ? exception.message : String(exception);
    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} -> 500 ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      requestId,
    });
  }
}
