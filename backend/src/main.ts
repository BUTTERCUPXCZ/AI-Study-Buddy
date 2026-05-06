import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { json, raw, urlencoded } from 'body-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validateEnv } from './config/validate-env';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { requestLogger } from './common/middleware/request-logger.middleware';

async function bootstrap() {
  // S6: validate environment before doing anything else. In production a
  // missing/invalid required var exits the process; in dev we warn so
  // contributors can iterate on subsystems without setting every key.
  validateEnv();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    // S5: disable Nest's default body parsers so we can mount our own with
    // explicit size limits below.
    bodyParser: false,
  });

  // Fail closed: if FRONTEND_URL isn't set we cannot safely configure CORS,
  // CSP, or set SameSite=None cookies. Refuse to start in that case.
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    Logger.error(
      'FRONTEND_URL is not set. Refusing to start — required for CORS, CSP, and cookies.',
    );
    process.exit(1);
  }

  // Trust the first proxy hop so request.ip reflects the real client IP
  // (Render terminates TLS in front of us). Without this the throttler
  // sees the proxy's IP and rate limits become global.
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance() as unknown as {
    set?: (k: string, v: number | boolean) => void;
  };
  if (typeof instance.set === 'function') {
    instance.set('trust proxy', 1);
  }

  // Access log: stamps every request with an `X-Request-Id`, logs an
  // arrival line up front, and a completion line on `res.finish` with
  // status / duration / userId. Mounted before parsers so even oversized
  // body 413s show up in the access log.
  app.use(requestLogger);

  // S5: Stripe webhook needs the raw body for signature verification. Mount
  // it FIRST so the JSON parser below doesn't consume the stream.
  const STRIPE_WEBHOOK_PATH = '/webhooks/stripe';
  app.use(
    STRIPE_WEBHOOK_PATH,
    raw({ type: 'application/json', limit: '1mb' }),
    (
      req: Request & { rawBody?: Buffer },
      _res: Response,
      next: NextFunction,
    ) => {
      if (!req.rawBody) {
        const body = req.body as Buffer;
        req.rawBody = Buffer.isBuffer(body)
          ? body
          : Buffer.from(JSON.stringify(body || {}));
      }
      next();
    },
  );

  // S5: explicit JSON / urlencoded caps. 256 KB fits the largest legitimate
  // payload (an updated note's content) with headroom. Anything larger is
  // either a bug or an attacker probing for limits — return 413. Skip the
  // Stripe path because the raw parser above already consumed its body.
  const jsonParser = json({ limit: '256kb' });
  const urlEncodedParser = urlencoded({ limit: '256kb', extended: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === STRIPE_WEBHOOK_PATH) return next();
    jsonParser(req, res, next);
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === STRIPE_WEBHOOK_PATH) return next();
    urlEncodedParser(req, res, next);
  });

  app.use(cookieParser());

  app.enableCors({
    origin: frontendUrl,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    // S11: allow X-CSRF-Token header so the frontend's double-submit
    // pattern can pass through CORS preflight.
    allowedHeaders: 'Content-Type, Accept, Authorization, X-CSRF-Token',
    credentials: true,
  });

  // S4: Helmet. CSP / HSTS / frame-ancestors / referrer policy + the new
  // headers (Permissions-Policy via custom middleware below since Helmet's
  // built-in API was deprecated in v5; COOP/CORP via crossOriginXxxPolicy
  // options). connectSrc is restricted to first-party + Stripe API; imgSrc
  // is an explicit allow-list of expected origins instead of `https:` which
  // would let attackers exfiltrate via any image CDN.
  const supabaseUrl = process.env.SUPABASE_URL ?? '';
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).origin : '';
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://js.stripe.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          // S4: explicit allow-list for images instead of the wildcard
          // `https:` previously in place.
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            frontendUrl,
            ...(supabaseHost ? [supabaseHost] : []),
            'https://*.supabase.co',
            'https://js.stripe.com',
          ],
          connectSrc: [
            "'self'",
            frontendUrl,
            'https://api.stripe.com',
            ...(supabaseHost ? [supabaseHost] : []),
            'https://*.supabase.co',
            'wss://*.supabase.co',
          ],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // S4: harden against Spectre-class side-channel attacks and
      // cross-origin reads from legacy browsers that ignore CORS for
      // some script-loaded resources.
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      // Stripe iframes need to embed third-party origins; leaving COEP off
      // avoids breaking the checkout / billing portal flow.
      crossOriginEmbedderPolicy: false,
    }),
  );

  // S4: Permissions-Policy — deny powerful APIs the app never needs.
  // Stripe iframe handles its own payment-handler permission; we deny
  // payment at the top frame so a compromised script in our origin can't
  // open a Payment Request UI.
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      'Permissions-Policy',
      [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'magnetometer=()',
        'gyroscope=()',
        'accelerometer=()',
        'interest-cohort=()',
      ].join(', '),
    );
    next();
  });

  // Global request validation. whitelist + forbidNonWhitelisted reject any
  // field not declared on the DTO; transform applies @Type() conversions.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Catch-all filter: maps unexpected errors to a generic 500 with no
  // stack trace leakage. Full detail goes to server logs.
  app.useGlobalFilters(new AllExceptionsFilter());

  // S11: CSRF double-submit middleware. Mounted AFTER cookieParser so it
  // can read the cookie, AFTER the Stripe raw handler so server-to-server
  // webhooks aren't blocked. EXEMPT_PATHS inside the middleware skip
  // bootstrap auth routes that fire before the token exists.
  const csrf = new CsrfMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) => {
    csrf.use(req, res, next);
  });

  // S5: tighten timeouts on the underlying HTTP server so a slow-loris
  // attacker holding a connection without sending headers / body cannot
  // tie up a worker indefinitely. Defaults in Node 18+ are already
  // reasonable but we set them explicitly so behaviour is predictable.
  const server = app.getHttpServer() as {
    headersTimeout?: number;
    requestTimeout?: number;
    keepAliveTimeout?: number;
  };
  if (server) {
    server.headersTimeout = 60_000; // 60s to send full headers
    server.requestTimeout = 30_000; // 30s end-to-end per request
    server.keepAliveTimeout = 5_000; // close idle keep-alive after 5s
  }

  await app.listen(process.env.PORT ?? 3000);
  Logger.log(`Server listening on port ${process.env.PORT ?? 3000}`);
}

void bootstrap();
