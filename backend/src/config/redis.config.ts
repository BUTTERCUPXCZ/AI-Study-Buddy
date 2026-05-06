import { registerAs } from '@nestjs/config';

// Single ioredis TCP client config. Either provide REDIS_URL (rediss:// or
// redis://) or the host/port/password/tls quartet. The previous Upstash REST
// keys (UPSTASH_REDIS_REST_URL / TOKEN) are no longer used by the app — they
// can be removed from the deploy environment.
export default registerAs('redis', () => ({
  url: process.env.REDIS_URL,
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true',
}));
