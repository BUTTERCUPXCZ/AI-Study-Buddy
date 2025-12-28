import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from '../stripe/stripe.service';
import { DatabaseService } from '../database/database.service';
import { RawBody } from '../common/decorators/raw-body.decorator';
import Stripe from 'stripe';

@Controller('webhooks/stripe')
export class WebhookController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    )!;

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );
      console.log('Stripe webhook received:', event.type);
      console.log('Event payload:', JSON.stringify(event.data.object, null, 2));
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      throw new BadRequestException(`Webhook Error: ${(err as Error).message}`);
    }

    // Handle different event types
    type CheckoutSessionEvent = Stripe.Event & {
      type: 'checkout.session.completed';
      data: { object: Stripe.Checkout.Session };
    };

    function isCheckoutSessionEvent(
      e: Stripe.Event,
    ): e is CheckoutSessionEvent {
      return e.type === 'checkout.session.completed';
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        if (!isCheckoutSessionEvent(event)) break;
        const session = event.data.object; // now correctly typed as Stripe.Checkout.Session
        const userId = session.client_reference_id || session.metadata?.userId;
        const subscriptionId = session.subscription as string | undefined;
        const customerId = session.customer as string | undefined;

        if (userId && subscriptionId) {
          // call your service to mark subscription active
          await this.subscriptionsService.handleSubscriptionCreated(
            customerId ?? '',
            subscriptionId,
            userId,
          );
        } else {
          console.warn(
            'Missing userId or subscriptionId on checkout.session.completed',
            { userId, subscriptionId, customerId, session },
          );
        }
        break;
      }

      case 'customer.subscription.created': {
        console.log('Received customer.subscription.created event');
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const user = await this.databaseService.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          console.log(
            `Updating subscription status for user ${user.id} to ${subscription.status === 'active' ? 'PRO' : 'FREE'}`,
          );
          const status = subscription.status === 'active' ? 'PRO' : 'FREE';
          await this.databaseService.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: status,
              subscriptionCurrentPeriodEnd:
                status === 'PRO'
                  ? new Date(
                      // @ts-expect-error Stripe types do not include current_period_end
                      subscription.current_period_end * 1000,
                    )
                  : null,
            },
          });
        } else {
          console.log(`No user found for customerId: ${customerId}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        console.log('Received customer.subscription.updated event');
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const user = await this.databaseService.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          if (subscription.status === 'active') {
            console.log(`Updating user ${user.id} to PRO`);
            await this.databaseService.user.update({
              where: { id: user.id },
              data: {
                subscriptionStatus: 'PRO',
                subscriptionCurrentPeriodEnd: new Date(
                  // @ts-expect-error Stripe types do not include current_period_end
                  subscription.current_period_end * 1000,
                ),
              },
            });
          } else if (
            subscription.status === 'canceled' ||
            subscription.status === 'unpaid'
          ) {
            console.log(`Cancelling subscription for user ${user.id}`);
            await this.subscriptionsService.handleSubscriptionCancelled(
              user.id,
            );
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        console.log('Received customer.subscription.deleted event');
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const user = await this.databaseService.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          console.log(`Deleting subscription for user ${user.id}`);
          await this.subscriptionsService.handleSubscriptionCancelled(user.id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }
}
