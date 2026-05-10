import {
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from '../stripe/stripe.service';
import { DatabaseService } from '../database/database.service';
import { RawBody } from '../common/decorators/raw-body.decorator';
import { AuditService } from '../common/services/audit.service';
import Stripe from 'stripe';

@Controller('webhooks/stripe')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly auditService: AuditService,
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
      event = this.stripeService.constructWebhookEvent(
        rawBody,
        signature,
        webhookSecret,
      );
      this.logger.debug(
        `Stripe webhook received: ${event.type} (id ${event.id})`,
      );
    } catch (err) {
      this.logger.warn(
        `Webhook signature verification failed: ${(err as Error).message}`,
      );
      throw new BadRequestException(`Webhook Error: ${(err as Error).message}`);
    }

    // S8 — replay window. Stripe signatures stay valid forever for the
    // body that signed them. An attacker who captures one event header +
    // body pair could replay it months later. event.created is the unix
    // timestamp Stripe stamped at construction time; reject anything
    // older than 5 minutes (with 30 s leeway for clock skew). The
    // `StripeEvent.id` unique constraint catches exact replays of events
    // we've already processed; this catches replays of events we haven't
    // seen yet because they happened long ago.
    const REPLAY_WINDOW_S = 5 * 60;
    const CLOCK_SKEW_S = 30;
    const nowS = Math.floor(Date.now() / 1000);
    if (
      event.created &&
      nowS - event.created > REPLAY_WINDOW_S + CLOCK_SKEW_S
    ) {
      const ageS = nowS - event.created;
      this.logger.warn(
        `Stripe webhook rejected as too old: id=${event.id} age=${ageS}s`,
      );
      this.auditService.record({
        action: 'webhook_replay_rejected',
        target: event.id,
        meta: { type: event.type, ageS },
      });
      throw new BadRequestException('Webhook too old');
    }

    // Idempotency: refuse duplicate event.id. Stripe may retry the same
    // event multiple times; processing it twice would double-credit
    // subscription state.
    try {
      await this.databaseService.stripeEvent.create({
        data: { id: event.id, type: event.type },
      });
    } catch (err) {
      // Most common cause is unique-constraint violation on duplicate id.
      this.logger.debug(
        `Duplicate Stripe event ${event.id} ignored (${(err as Error).message})`,
      );
      return { received: true, duplicate: true };
    }

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
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const subscriptionId = session.subscription as string | undefined;
        const customerId = session.customer as string | undefined;

        if (userId && subscriptionId) {
          await this.subscriptionsService.handleSubscriptionCreated(
            customerId ?? '',
            subscriptionId,
            userId,
          );
          await this.auditService.record({
            action: 'subscription_checkout_completed',
            userId,
            target: subscriptionId,
            meta: { stripeEventId: event.id },
          });
        } else {
          this.logger.warn(
            `Missing userId or subscriptionId on checkout.session.completed (event ${event.id})`,
          );
        }
        break;
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const user = await this.databaseService.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          const status = subscription.status === 'active' ? 'PRO' : 'FREE';

          const periodEndTimestamp =
            subscription.items?.data?.[0]?.current_period_end;

          const periodEnd = (() => {
            const ts = periodEndTimestamp;
            if (typeof ts === 'number' && ts > 0) {
              const date = new Date(ts * 1000);
              return isNaN(date.getTime()) ? null : date;
            }
            return null;
          })();

          await this.databaseService.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: status,
              subscriptionCurrentPeriodEnd: status === 'PRO' ? periodEnd : null,
            },
          });
          this.logger.log(
            `Subscription created -> ${status} for user ${user.id}`,
          );
          await this.auditService.record({
            action: 'subscription_created',
            userId: user.id,
            meta: { status, stripeEventId: event.id },
          });
        } else {
          this.logger.warn(
            `customer.subscription.created with no matching user for customer ${customerId}`,
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const user = await this.databaseService.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          if (subscription.status === 'active') {
            await this.databaseService.user.update({
              where: { id: user.id },
              data: {
                subscriptionStatus: 'PRO',
                subscriptionCurrentPeriodEnd: (() => {
                  const ts = subscription.items?.data?.[0]?.current_period_end;
                  if (typeof ts === 'number' && ts > 0) {
                    const date = new Date(ts * 1000);
                    return isNaN(date.getTime()) ? null : date;
                  }
                  return null;
                })(),
              },
            });
            this.logger.log(`Subscription -> PRO for user ${user.id}`);
          } else if (
            subscription.status === 'canceled' ||
            subscription.status === 'unpaid'
          ) {
            await this.subscriptionsService.handleSubscriptionCancelled(
              user.id,
            );
            this.logger.log(`Subscription cancelled for user ${user.id}`);
            await this.auditService.record({
              action: 'subscription_cancelled',
              userId: user.id,
              meta: { stripeEventId: event.id },
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const user = await this.databaseService.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          await this.subscriptionsService.handleSubscriptionCancelled(user.id);
          this.logger.log(`Subscription deleted for user ${user.id}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        // Subscription state already handled in customer.subscription.created;
        // nothing to do here besides acknowledging.
        break;
      }

      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
  }
}
