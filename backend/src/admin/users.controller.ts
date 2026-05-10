import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permissions } from '../auth/rbac';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminUsersService } from './users.service';
import { AuditService } from '../common/services/audit.service';

@Controller('admin/users')
@UseGuards(AuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions(Permissions.USER_READ)
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('plan') plan?: 'FREE' | 'PRO',
    @Query('role') role?: UserRole,
  ) {
    return this.users.list({
      cursor,
      limit: limit ? Number(limit) : undefined,
      q,
      plan,
      role,
    });
  }

  @Get(':id')
  @RequirePermissions(Permissions.USER_READ)
  async getOne(@Param('id') id: string) {
    return this.users.getById(id);
  }

  @Patch(':id/role')
  @RequirePermissions(Permissions.USER_PROMOTE)
  async setRole(
    @CurrentUser('id') actorId: string,
    @Param('id') targetId: string,
    @Body('role') role: UserRole,
    @Req() request: Request,
  ) {
    const result = await this.users.setRole(actorId, targetId, role);
    this.audit.record({
      userId: actorId,
      action:
        result.previousRole === role
          ? 'admin_user_promoted'
          : isPromotion(result.previousRole, role)
            ? 'admin_user_promoted'
            : 'admin_user_demoted',
      target: targetId,
      meta: { from: result.previousRole, to: role },
      request,
    });
    return result;
  }
}

function isPromotion(from: UserRole, to: UserRole): boolean {
  const order: Record<UserRole, number> = {
    USER: 0,
    SUPPORT: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };
  return order[to] > order[from];
}
