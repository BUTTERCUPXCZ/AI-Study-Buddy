import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class UsageService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Increment user's attempt count (only for free users)
   */
  async incrementAttempts(userId: string): Promise<void> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    });

    // Only increment for free users
    if (user?.subscriptionStatus !== 'PRO') {
      await this.databaseService.user.update({
        where: { id: userId },
        data: {
          attemptsUsed: {
            increment: 1,
          },
        },
      });
    }
  }

  /**
   * Check if user can perform action
   */
  async canPerformAction(userId: string): Promise<boolean> {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        attemptsUsed: true,
      },
    });

    if (!user) {
      return false;
    }

    // Pro users always allowed
    if (user.subscriptionStatus === 'PRO') {
      return true;
    }

    // Free users: check limit
    return user.attemptsUsed < 5;
  }

  /**
   * Get usage stats for user
   */
  async getUsageStats(userId: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        attemptsUsed: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      plan: user.subscriptionStatus || 'FREE',
      attemptsUsed: user.attemptsUsed || 0,
      attemptsLimit: user.subscriptionStatus === 'PRO' ? null : 5,
      attemptsRemaining:
        user.subscriptionStatus === 'PRO'
          ? null
          : Math.max(0, 5 - (user.attemptsUsed || 0)),
    };
  }
}
