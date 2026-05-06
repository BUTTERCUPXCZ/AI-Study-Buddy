import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';

/**
 * Prisma client wrapped with the read-replicas extension. When REPLICA_URL
 * is set, plain reads (`findMany`, `findUnique`, `findFirst`, `count`,
 * `aggregate`) hit the replica; writes and `$transaction` always hit the
 * primary. With no REPLICA_URL the wrapper is a no-op and behaviour is
 * identical to a vanilla PrismaClient — safe to roll out.
 *
 * Important: this class extends PrismaClient and exports a value that *also*
 * has the extension applied. We do that by assigning `Object.assign(this,
 * extended)` so existing callers keep using `databaseService.note.findMany`
 * etc. without changing their signatures.
 */
@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);

  constructor() {
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    const replicaUrl = process.env.REPLICA_URL;
    if (replicaUrl) {
      // The extension returns a new client that proxies methods. We mutate
      // `this` so the dependency-injected DatabaseService instance routes
      // reads to the replica without any caller-side change.
      const extended = this.$extends(readReplicas({ url: replicaUrl }));
      Object.assign(this, extended);
      this.logger.log('Prisma read replica routing enabled');
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
