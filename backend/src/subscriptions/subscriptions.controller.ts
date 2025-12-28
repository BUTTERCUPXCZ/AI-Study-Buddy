import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';
import Stripe from 'stripe';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

@Controller('subscriptions')
@UseGuards(AuthGuard) // Protect all routes
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('checkout')
  async createCheckout(
    @Req() req: AuthenticatedRequest,
    @Body() body: { baseUrl?: string },
  ) {
    const userId = req.user!.id;
    const baseUrl = body.baseUrl || 'http://localhost:5173'; // Default to frontend URL

    return await this.subscriptionsService.createCheckoutSession(
      userId,
      baseUrl,
    );
  }

  @Post('verify-session')
  async verifySession(
    @Body() body: { sessionId: string },
  ): Promise<{ verified: boolean }> {
    try {
      const session: Stripe.Checkout.Session =
        await this.subscriptionsService.retrieveSession(body.sessionId);

      if (session.payment_status === 'paid') {
        // Best-effort: if webhook was missed/delayed, update DB here using session info
        try {
          const userId =
            session.client_reference_id || session.metadata?.userId;
          const subscriptionId = session.subscription as string | undefined;
          const customerId = session.customer as string | undefined;

          if (userId && subscriptionId) {
            await this.subscriptionsService.handleSubscriptionCreated(
              customerId ?? '',
              subscriptionId,
              userId,
            );
          }
        } catch (err) {
          console.error(
            'verify-session: failed to apply subscription from session',
            err,
          );
        }

        return { verified: true };
      }

      throw new BadRequestException('Payment not completed');
    } catch {
      throw new BadRequestException('Invalid session or payment not found');
    }
  }

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return await this.subscriptionsService.getUserSubscription(userId);
  }

  @Post('portal')
  async createPortal(
    @Req() req: AuthenticatedRequest,
    @Body() body: { baseUrl?: string },
  ) {
    const userId = req.user!.id;
    const baseUrl = body.baseUrl || 'http://localhost:5173';

    return await this.subscriptionsService.createPortalSession(userId, baseUrl);
  }
}
