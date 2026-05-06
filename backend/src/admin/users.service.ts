import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

export interface ListUsersOptions {
  cursor?: string;
  limit?: number;
  q?: string;
  plan?: 'FREE' | 'PRO';
  role?: UserRole;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly db: DatabaseService) {}

  async list(opts: ListUsersOptions) {
    const limit = Math.max(1, Math.min(opts.limit ?? 25, 100));
    const where: Prisma.UserWhereInput = {};
    if (opts.q) {
      where.OR = [
        { email: { contains: opts.q, mode: 'insensitive' } },
        { Fullname: { contains: opts.q, mode: 'insensitive' } },
      ];
    }
    if (opts.plan) where.subscriptionStatus = opts.plan;
    if (opts.role) where.role = opts.role;

    const items = await this.db.user.findMany({
      where,
      orderBy: [{ lastLoginAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(opts.cursor && { cursor: { id: opts.cursor }, skip: 1 }),
      select: {
        id: true,
        email: true,
        Fullname: true,
        role: true,
        subscriptionStatus: true,
        emailVerified: true,
        attemptsUsed: true,
        lastLoginAt: true,
        stripeCustomerId: true,
      },
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page,
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  async getById(id: string) {
    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { notes: true, quizzes: true, files: true, jobs: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Promote / demote another user. Restricted by `RolesGuard` to
   * SUPER_ADMIN at the controller layer; this method also refuses to
   * let an actor demote themselves out of SUPER_ADMIN (last-admin
   * lockout protection).
   */
  async setRole(actorId: string, targetId: string, newRole: UserRole) {
    if (actorId === targetId && newRole !== UserRole.SUPER_ADMIN) {
      // Soft guard: if you're the only SUPER_ADMIN, prevent self-demote.
      const supers = await this.db.user.count({
        where: { role: UserRole.SUPER_ADMIN },
      });
      if (supers <= 1) {
        throw new ForbiddenException(
          'Cannot demote the last SUPER_ADMIN. Promote another admin first.',
        );
      }
    }
    const target = await this.db.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    const updated = await this.db.user.update({
      where: { id: targetId },
      data: { role: newRole },
      select: { id: true, email: true, role: true },
    });
    return { previousRole: target.role, ...updated };
  }
}
