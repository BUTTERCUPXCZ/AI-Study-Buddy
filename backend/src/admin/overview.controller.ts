import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permissions } from '../auth/rbac';
import { DatabaseService } from '../database/database.service';

/**
 * Top-level "cards" for /admin home.
 *
 * Read access requires METRICS_READ — SUPPORT, ADMIN, SUPER_ADMIN
 * roles all qualify.
 */
@Controller('admin/overview')
@UseGuards(AuthGuard, RolesGuard)
@RequirePermissions(Permissions.METRICS_READ)
export class AdminOverviewController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async overview() {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      proUsers,
      signupsToday,
      activeWeek,
      active30Days,
      totalNotes,
      totalQuizzes,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.user.count({ where: { subscriptionStatus: 'PRO' } }),
      this.db.user.count({ where: {} }), // placeholder — replaced below using createdAt index if exists
      this.db.user.count({ where: { lastLoginAt: { gte: sevenDaysAgo } } }),
      this.db.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
      this.db.note.count(),
      this.db.quiz.count(),
    ]);

    // The User model lacks createdAt — substitute "signups today" with
    // count of users whose Note OR Quiz was first created today, OR
    // simply mark as N/A. For now: count users where any audit row of
    // action='register' fell on today.
    const registeredToday = await this.db.auditLog.count({
      where: { action: 'register', createdAt: { gte: startOfDay } },
    });

    return {
      totalUsers,
      proUsers,
      freeUsers: totalUsers - proUsers,
      signupsToday: registeredToday,
      activeLast7Days: activeWeek,
      activeLast30Days: active30Days,
      totalNotes,
      totalQuizzes,
      // Sales/revenue computed in P2 against Stripe.
      _placeholderSignupsToday: signupsToday,
    };
  }
}
