import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}

export const RawBody = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): Buffer => {
    const request = ctx.switchToHttp().getRequest<RequestWithRawBody>();
    // Some body-parser/raw middleware variants place the raw buffer on
    // `request.rawBody`, others set `request.body` to the raw Buffer.
    // Fall back to `request.body` if `rawBody` is not present. If the
    // body is already parsed (object), serialize it to a Buffer so
    // Stripe signature verification still receives a Buffer.
    if (request.rawBody) return request.rawBody;
    const body = request.body as unknown;
    if (Buffer.isBuffer(body)) return body;
    // If no buffer available, stringify the body to a Buffer as a last resort.
    try {
      return Buffer.from(
        typeof body === 'string' ? body : JSON.stringify(body),
      );
    } catch {
      return Buffer.from('');
    }
  },
);
