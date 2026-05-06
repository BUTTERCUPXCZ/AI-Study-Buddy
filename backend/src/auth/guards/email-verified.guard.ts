import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

/**
 * S2 — gate routes that cost money or storage behind a verified email.
 *
 * Without this guard, a bot signing up with `tempmail+abc@…` immediately
 * gets free access to the AI generation, PDF upload, notes, and quizzes
 * surfaces — meaning a single attacker with disposable inboxes can burn
 * Gemini quota and storage for free, with no path to attribution.
 *
 * Run AFTER `AuthGuard` so `request.user.id` is populated. Looks up the
 * `emailVerified` field on the user row; rejects with 403 if false.
 *
 * Auth, subscription billing, and the verification callback itself stay
 * open — the user has to be able to verify before they can use anything.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      user?: { id?: string };
    }>();
    const userId = req.user?.id;
    if (!userId) {
      throw new ForbiddenException(
        'Email verification check requires AuthGuard',
      );
    }

    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: { emailVerified: true },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email not verified. Please verify your email before using this feature.',
      );
    }

    return true;
  }
}
