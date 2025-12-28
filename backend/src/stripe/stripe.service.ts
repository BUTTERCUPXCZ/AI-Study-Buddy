import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutDto } from './dto/checkout.dto';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY')!,
      {
        apiVersion: '2025-12-15.clover',
      },
    );
  }

  async createCheckoutSession(checkoutDto: CheckoutDto) {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: checkoutDto.priceId,
          quantity: 1,
        },
      ],
      success_url: checkoutDto.successUrl,
      cancel_url: checkoutDto.cancelUrl,
      client_reference_id: checkoutDto.userId,
      metadata: {
        userId: checkoutDto.userId,
      },
      // Ensure subscription objects created by Checkout include the userId
      subscription_data: {
        metadata: {
          userId: checkoutDto.userId,
        },
      },
    };

    if (checkoutDto.customerId) {
      sessionParams.customer = checkoutDto.customerId;
    } else {
      sessionParams.customer_email = undefined;
    }
    return await this.stripe.checkout.sessions.create(sessionParams);
  }

  async getOrCreateCustomer(
    email: string,
    userId: string,
  ): Promise<Stripe.Customer> {
    // First, try to find existing customer by email
    const customers = await this.stripe.customers.list({
      email,
      limit: 1,
    });

    if (customers.data.length > 0) {
      return customers.data[0];
    }

    // Create new customer
    return await this.stripe.customers.create({
      email,
      metadata: {
        userId,
      },
    });
  }

  /**
   * Get customer's active subscription
   */
  async getActiveSubscription(
    customerId: string,
  ): Promise<Stripe.Subscription | null> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    return subscriptions.data.length > 0 ? subscriptions.data[0] : null;
  }

  /**
   * Get subscription by ID
   */
  async getSubscriptionById(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(subscriptionId);
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Create a portal session for customer to manage subscription
   */
  async createPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<Stripe.BillingPortal.Session> {
    return await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  /**
   * Retrieve a checkout session
   */
  async retrieveCheckoutSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.retrieve(sessionId);
  }

  /**
   * Verify webhook signature
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): Stripe.Event {
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }
}
