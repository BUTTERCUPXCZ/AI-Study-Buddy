import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permissions } from '../auth/rbac';
import { AdminMetricsService } from './metrics.service';

@Controller('admin/metrics')
@UseGuards(AuthGuard, RolesGuard)
@RequirePermissions(Permissions.METRICS_READ)
export class AdminMetricsController {
  constructor(private readonly metrics: AdminMetricsService) {}

  @Get()
  async snapshot() {
    return this.metrics.snapshot();
  }
}
