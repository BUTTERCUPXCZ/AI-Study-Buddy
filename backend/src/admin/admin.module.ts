import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminOverviewController } from './overview.controller';
import { AdminUsersController } from './users.controller';
import { AdminUsersService } from './users.service';
import { AdminAuditController } from './audit.controller';
import { AdminMetricsController } from './metrics.controller';
import { AdminMetricsService } from './metrics.service';

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    // Re-register the queues we need read access to. BullMQ lookups are
    // name-keyed so this shares the same instance JobsModule already
    // owns.
    BullModule.registerQueue(
      { name: 'pdf-extract' },
      { name: 'ai-notes' },
      { name: 'ai-quiz' },
      { name: 'completion' },
      { name: 'pdf-ultra-optimized' },
    ),
  ],
  controllers: [
    AdminOverviewController,
    AdminUsersController,
    AdminAuditController,
    AdminMetricsController,
  ],
  providers: [RolesGuard, AdminUsersService, AdminMetricsService],
})
export class AdminModule {}
