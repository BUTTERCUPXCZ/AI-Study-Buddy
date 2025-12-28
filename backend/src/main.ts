import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { raw } from 'body-parser';
import { Logger } from '@nestjs/common';
import { Request } from 'express';

async function bootstrap() {
  // Enable all Nest log levels so console output appears during development
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
    credentials: true,
  });
  app.use(helmet());

  // Raw body parser for Stripe webhooks. Also copy the raw buffer to `req.rawBody`
  // so the RawBody decorator can access it.
  // Ensure raw body is available and also populate `req.rawBody` explicitly
  app.use(
    '/webhooks/stripe',
    raw({ type: 'application/json' }),
    (req: Request & { rawBody?: Buffer }, _res, next) => {
      if (!req.rawBody) {
        const body = req.body as Buffer;
        req.rawBody = Buffer.isBuffer(body)
          ? body
          : Buffer.from(JSON.stringify(body || {}));
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      next();
    },
  );

  await app.listen(process.env.PORT ?? 3000);
  Logger.log(`Server listening on port ${process.env.PORT ?? 3000}`);
}

void bootstrap();
