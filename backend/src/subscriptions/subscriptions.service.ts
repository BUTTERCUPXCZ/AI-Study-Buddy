import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StripeService } from 'src/stripe/stripe.service';
import { DatabaseService } from 'src/database/database.service';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class SubscriptionsService {
  stripe: any;
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create checkout session for Pro subscription
   */
  async createCheckoutSession(userId: string, baseUrl: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get or create Stripe customer
    const customer = await this.stripeService.getOrCreateCustomer(
      user.email,
      userId,
    );

    // Update user with Stripe customer ID if not set
    if (!user.stripeCustomerId) {
      await this.databaseService.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });
    }

    const priceId = this.configService.get<string>('STRIPE_PRICE_ID_PRO')!;

    const checkoutDto = {
      customerId: customer.id,
      priceId,
      userId,
      successUrl: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/`,
    };

    const session = await this.stripeService.createCheckoutSession(checkoutDto);

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Handle successful subscription (called from webhook)
   */
  async handleSubscriptionCreated(
    customerId: string,
    subscriptionId: string,
    userId: string,
  ) {
    const subscription =
      await this.stripeService.getSubscriptionById(subscriptionId);

    // Update user subscription status
    // Note: current_period_end is a Unix timestamp in seconds
    // Using type assertion to access property that may not be in type definition
    const periodEndTimestamp = (
      subscription as Stripe.Subscription & {
        current_period_end: number;
      }
    ).current_period_end;

    const periodEnd = periodEndTimestamp
      ? new Date(periodEndTimestamp * 1000)
      : null;

    await this.databaseService.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'PRO',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionCurrentPeriodEnd: periodEnd,
      },
    });
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCancelled(userId: string) {
    await this.databaseService.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'FREE',
        stripeSubscriptionId: null,
        subscriptionCurrentPeriodEnd: null,
      },
    });
  }

  /**
   * Get user subscription status
   */
  async getUserSubscription(userId: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        subscriptionStatus: true,
        subscriptionCurrentPeriodEnd: true,
        attemptsUsed: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      plan: user.subscriptionStatus || 'FREE',
      periodEnd: user.subscriptionCurrentPeriodEnd,
      attemptsUsed: user.attemptsUsed || 0,
      attemptsLimit: user.subscriptionStatus === 'PRO' ? null : 5,
    };
  }

  /**
   * Create portal session for managing subscription
   */
  async createPortalSession(userId: string, baseUrl: string) {
    const user = await this.databaseService.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeCustomerId) {
      throw new BadRequestException('No active subscription');
    }

    const session = await this.stripeService.createPortalSession(
      user.stripeCustomerId,
      `${baseUrl}/settings`,
    );

    return { url: session.url };
  }

  /**
   * Retrieve and verify checkout session
   */
  async retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.stripeService.retrieveCheckoutSession(sessionId);
  }
}
