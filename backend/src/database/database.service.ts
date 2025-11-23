import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    void ((await this.$connect()) as Promise<void>);
  }

  async onModuleDestroy(): Promise<void> {
    void ((await this.$disconnect()) as Promise<void>);
  }
}
