import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permissions } from '../auth/rbac';
import { DatabaseService } from '../database/database.service';
import { Prisma } from '@prisma/client';

@Controller('admin/audit')
@UseGuards(AuthGuard, RolesGuard)
@RequirePermissions(Permissions.AUDIT_READ)
export class AdminAuditController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async list(
    @Query('cursor') cursor?: string,
    @Query('limit') limitRaw?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
  ) {
    const limit = Math.max(1, Math.min(Number(limitRaw) || 50, 200));
    const where: Prisma.AuditLogWhereInput = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;

    const rows = await this.db.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
