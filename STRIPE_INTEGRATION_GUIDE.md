# Complete Stripe Integration Guide for AI Study Buddy

This guide will teach you how to integrate Stripe payments and implement subscription-based pricing (Free vs Pro plans) for your application.

## Table of Contents
1. [Overview](#overview)
2. [Backend Setup](#backend-setup)
3. [Database Schema Updates](#database-schema-updates)
4. [Backend Implementation](#backend-implementation)
5. [Frontend Setup](#frontend-setup)
6. [Frontend Implementation](#frontend-implementation)
7. [Usage Tracking & Limits](#usage-tracking--limits)
8. [Testing](#testing)

---

## Overview

### What You'll Build
- **Free Plan**: 5 attempts total, then features disabled
- **Pro Plan**: ₱100/month, unlimited attempts
- Stripe Checkout for payment processing
- Webhook handling for subscription events
- Usage tracking and enforcement

### Architecture Flow
```
User clicks "Upgrade to Pro" 
  → Frontend calls backend to create checkout session
  → Backend creates Stripe Checkout Session
  → User redirected to Stripe payment page
  → After payment, Stripe sends webhook to backend
  → Backend updates user subscription status
  → User redirected back to app with active Pro subscription
```

---
 
## Backend Setup

### Step 1: Install Stripe Package

Your `package.json` already has `stripe` in devDependencies, but you need it in dependencies:

```bash
cd backend
npm install stripe
```

### Step 2: Add Stripe Environment Variables

Add to your `.env` file:

```env
# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...  # Get from Stripe Dashboard
STRIPE_PUBLISHABLE_KEY=pk_test_...  # Get from Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_...  # Get after setting up webhook endpoint
STRIPE_PRICE_ID_PRO=price_...  # Create a Price in Stripe Dashboard for Pro plan
```

**How to get these:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get API keys from "Developers" → "API keys"
3. Create a Product and Price:
   - Products → "Add product"
   - Name: "Pro Plan"
   - Pricing: Recurring, ₱100/month
   - Copy the Price ID (starts with `price_`)

### Step 3: Create Stripe Service

Create `backend/src/stripe/stripe.service.ts`:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY')!,
      {
        apiVersion: '2024-12-18.acacia', // Use latest stable version
      },
    );
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    customerId: string | null,
    priceId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: userId, // Pass user ID to identify in webhook
      metadata: {
        userId, // Also store in metadata
      },
    };

    // If customer exists, attach to session
    if (customerId) {
      sessionParams.customer = customerId;
    } else {
      // Create customer on the fly
      sessionParams.customer_email = undefined; // Will be collected in checkout
    }

    return await this.stripe.checkout.sessions.create(sessionParams);
  }

  /**
   * Create or retrieve Stripe customer
   */
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
```

### Step 4: Create Subscription Module

Create `backend/src/subscriptions/subscriptions.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from '../stripe/stripe.service';
import { DatabaseService } from '../database/database.service';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, StripeService, DatabaseService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
```

### Step 5: Create Subscriptions Service

Create `backend/src/subscriptions/subscriptions.service.ts`:

```typescript
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { StripeService } from '../stripe/stripe.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubscriptionsService {
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

    const session = await this.stripeService.createCheckoutSession(
      customer.id,
      priceId,
      userId,
      `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      `${baseUrl}/subscription/cancel`,
    );

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
    const subscription = await this.stripeService.getActiveSubscription(
      customerId,
    );

    if (!subscription) {
      throw new BadRequestException('Subscription not found');
    }

    // Update user subscription status
    await this.databaseService.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'PRO',
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionCurrentPeriodEnd: new Date(
          subscription.current_period_end * 1000,
        ),
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
}
```

### Step 6: Create Auth Guard (if you don't have one)

Since your app uses token-based authentication, create a reusable guard:

Create `backend/src/auth/auth.guard.ts`:

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header');
    }

    const token = authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const user = await this.authService.verifyToken(token);
      // Attach user to request object for use in controllers
      request.user = {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
      };
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
```

**Note**: Make sure `AuthService` is exported from `auth.module.ts` and `AuthGuard` is provided in the module.

### Step 7: Create Subscriptions Controller

Create `backend/src/subscriptions/subscriptions.controller.ts`:

```typescript
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

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

@Controller('subscriptions')
@UseGuards(AuthGuard) // Protect all routes
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  @Post('checkout')
  async createCheckout(@Req() req: AuthenticatedRequest, @Body() body: { baseUrl?: string }) {
    const userId = req.user!.id;
    const baseUrl = body.baseUrl || 'http://localhost:5173'; // Default to frontend URL

    return await this.subscriptionsService.createCheckoutSession(
      userId,
      baseUrl,
    );
  }

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    const userId = req.user!.id;
    return await this.subscriptionsService.getUserSubscription(userId);
  }

  @Post('portal')
  async createPortal(@Req() req: AuthenticatedRequest, @Body() body: { baseUrl?: string }) {
    const userId = req.user!.id;
    const baseUrl = body.baseUrl || 'http://localhost:5173';

    return await this.subscriptionsService.createPortalSession(userId, baseUrl);
  }
}
```

### Step 8: Create Webhook Controller

Create `backend/src/subscriptions/webhook.controller.ts`:

```typescript
import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from '../stripe/stripe.service';
import { DatabaseService } from '../database/database.service';

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
    @Req() req: Request,
    @Res() res: Response,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    )!;

    let event;

    try {
      // Verify webhook signature
      event = this.stripeService.constructWebhookEvent(
        req.body,
        signature,
        webhookSecret,
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId =
          session.client_reference_id || session.metadata?.userId;

        if (userId && session.mode === 'subscription') {
          // Get subscription details
          const subscriptionId = session.subscription as string;
          const customerId = session.customer as string;

          await this.subscriptionsService.handleSubscriptionCreated(
            customerId,
            subscriptionId,
            userId,
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Find user by Stripe customer ID
        const user = await this.databaseService.user.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (user) {
          if (subscription.status === 'active') {
            await this.databaseService.user.update({
              where: { id: user.id },
              data: {
                subscriptionStatus: 'PRO',
                subscriptionCurrentPeriodEnd: new Date(
                  subscription.current_period_end * 1000,
                ),
              },
            });
          } else if (
            subscription.status === 'canceled' ||
            subscription.status === 'unpaid'
          ) {
            await this.subscriptionsService.handleSubscriptionCancelled(
              user.id,
            );
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
          await this.subscriptionsService.handleSubscriptionCancelled(
            user.id,
          );
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  }
}
```

**Important**: For webhooks, you need to configure your NestJS app to accept raw body. Since you're using Fastify (based on your package.json), update `main.ts`:

```typescript
// In main.ts, before app.listen()
// For Fastify, you need to handle raw body differently
// You may need to use @fastify/raw-body or handle it in the webhook controller
// Alternatively, switch to Express for webhook handling, or use a middleware

// If using Express (change NestFactory.create to use Express):
import * as express from 'express';
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// If staying with Fastify, you'll need to configure raw body parsing
// in the webhook route specifically using Fastify's content type parser
```

### Step 9: Register Modules

Add to `backend/src/app.module.ts`:

```typescript
import { SubscriptionsModule } from './subscriptions/subscriptions.module';

@Module({
  imports: [
    // ... existing imports
    SubscriptionsModule,
  ],
  // ...
})
```

---

## Database Schema Updates

### Update Prisma Schema

Add these fields to your `User` model in `backend/prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(cuid())
  Fullname  String
  email     String   @unique
  supabaseId String   @unique
  password  String
  emailVerified Boolean @default(false)
  emailVerificationToken String?
  emailVerificationExpiresAt DateTime?
  
  // Subscription fields
  subscriptionStatus String @default("FREE") // "FREE" or "PRO"
  stripeCustomerId String? @unique
  stripeSubscriptionId String? @unique
  subscriptionCurrentPeriodEnd DateTime?
  
  // Usage tracking
  attemptsUsed Int @default(0) // Track how many attempts user has used
  
  notes     Note[]
  quizzes   Quiz[]
  files     File[]
  uploads   Upload[]
  jobs      Job[]
  chatSessions ChatSession[]
}
```

Then run migration:

```bash
cd backend
npx prisma migrate dev --name add_subscription_fields
npx prisma generate
```

---

## Frontend Setup

### Step 1: Install Stripe.js

```bash
cd frontend
npm install @stripe/stripe-js
```

### Step 2: Create Stripe Service

Create `frontend/src/services/StripeService.ts`:

```typescript
import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      throw new Error('Missing Stripe publishable key');
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};
```

### Step 3: Add Environment Variable

Add to `frontend/.env`:

```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Step 4: Create Subscription API Service

Create `frontend/src/services/SubscriptionService.ts`:

```typescript
import { api } from '@/lib/api';

export interface SubscriptionStatus {
  plan: 'FREE' | 'PRO';
  periodEnd: string | null;
  attemptsUsed: number;
  attemptsLimit: number | null;
}

export interface CheckoutSession {
  sessionId: string;
  url: string;
}

class SubscriptionService {
  /**
   * Create checkout session and redirect to Stripe
   */
  async createCheckoutSession(): Promise<void> {
    const baseUrl = window.location.origin;
    const response = await api.post<CheckoutSession>('/subscriptions/checkout', {
      baseUrl,
    });

    const stripe = await import('@/services/StripeService').then((m) =>
      m.getStripe(),
    );
    const stripeInstance = await stripe;

    if (!stripeInstance) {
      throw new Error('Failed to load Stripe');
    }

    // Redirect to Stripe Checkout
    const { error } = await stripeInstance.redirectToCheckout({
      sessionId: response.data.sessionId,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus> {
    const response = await api.get<SubscriptionStatus>('/subscriptions/status');
    return response.data;
  }

  /**
   * Open customer portal for subscription management
   */
  async openCustomerPortal(): Promise<void> {
    const baseUrl = window.location.origin;
    const response = await api.post<{ url: string }>('/subscriptions/portal', {
      baseUrl,
    });

    // Redirect to Stripe Customer Portal
    window.location.href = response.data.url;
  }
}

export const subscriptionService = new SubscriptionService();
```

### Step 5: Update Pricing Component

Update `frontend/src/components/landing/Pricing.tsx` to handle Pro button click:

```typescript
// Add import
import { subscriptionService } from '@/services/SubscriptionService'
import { useAuth } from '@/context/AuthContextDefinition'
import { useState } from 'react'

// Inside component, add:
const { user } = useAuth()
const [loading, setLoading] = useState(false)

const handleUpgrade = async () => {
  if (!user) {
    // Redirect to login/register
    window.location.href = '/register'
    return
  }

  setLoading(true)
  try {
    await subscriptionService.createCheckoutSession()
  } catch (error) {
    console.error('Checkout error:', error)
    alert('Failed to start checkout. Please try again.')
  } finally {
    setLoading(false)
  }
}

// Update the Pro plan button:
<Button
  variant={plan.buttonVariant}
  size="lg"
  className={...}
  onClick={plan.name === "Pro" ? handleUpgrade : undefined}
  disabled={loading}
>
  {loading ? 'Loading...' : plan.buttonText}
</Button>
```

### Step 6: Create Success/Cancel Pages

Create `frontend/src/routes/subscription.success.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { subscriptionService } from '@/services/SubscriptionService'

export function SubscriptionSuccess() {
  const navigate = useNavigate()
  const search = useSearch({ from: '/subscription/success' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verify session and update user data
    const verifySession = async () => {
      try {
        await subscriptionService.getSubscriptionStatus()
        // Refresh user data in auth context
        window.location.href = '/library' // Redirect to main app
      } catch (error) {
        console.error('Failed to verify subscription:', error)
      } finally {
        setLoading(false)
      }
    }

    if (search.session_id) {
      verifySession()
    } else {
      setLoading(false)
    }
  }, [search.session_id])

  if (loading) {
    return <div>Verifying subscription...</div>
  }

  return (
    <div>
      <h1>Subscription Successful!</h1>
      <p>Your Pro subscription is now active.</p>
      <button onClick={() => navigate({ to: '/library' })}>
        Go to Dashboard
      </button>
    </div>
  )
}
```

Create `frontend/src/routes/subscription.cancel.tsx`:

```typescript
import { Link } from '@tanstack/react-router'

export function SubscriptionCancel() {
  return (
    <div>
      <h1>Subscription Cancelled</h1>
      <p>You cancelled the subscription process.</p>
      <Link to="/LandingPage#pricing">Return to Pricing</Link>
    </div>
  )
}
```

---

## Usage Tracking & Limits

### Backend: Create Usage Guard

Create `backend/src/common/guards/usage.guard.ts`:

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UsageGuard implements CanActivate {
  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Get user with subscription status
    const dbUser = await this.databaseService.user.findUnique({
      where: { id: user.id },
      select: {
        subscriptionStatus: true,
        attemptsUsed: true,
      },
    });

    if (!dbUser) {
      return false;
    }

    // Pro users have unlimited access
    if (dbUser.subscriptionStatus === 'PRO') {
      return true;
    }

    // Free users: check if they've exceeded limit
    if (dbUser.attemptsUsed >= 5) {
      throw new ForbiddenException(
        'You have reached your free plan limit of 5 attempts. Please upgrade to Pro for unlimited access.',
      );
    }

    return true;
  }
}
```

### Backend: Create Usage Service

Create `backend/src/usage/usage.service.ts`:

```typescript
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
```

### Apply Usage Tracking to AI Endpoints

Update your AI controller to use the usage guard and service:

```typescript
// In ai.controller.ts
import { UseGuards } from '@nestjs/common';
import { UsageGuard } from '../common/guards/usage.guard';
import { UsageService } from '../usage/usage.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly usageService: UsageService, // Add this
  ) {}

  @Post('generate/notes')
  @UseGuards(UsageGuard) // Add this guard
  async generateNotes(@Body() dto: CreateNoteDto, @Req() req) {
    // Increment usage after successful generation
    await this.usageService.incrementAttempts(req.user.id);
    
    // ... rest of your logic
  }

  @Post('generate/quiz')
  @UseGuards(UsageGuard)
  async generateQuiz(@Body() dto: CreateQuizDto, @Req() req) {
    await this.usageService.incrementAttempts(req.user.id);
    // ... rest of your logic
  }

  // Apply to other AI endpoints as needed
}
```

### Frontend: Display Usage Stats

Update `app-layout.tsx` to show usage information:

```typescript
// Add hook to fetch usage stats
import { useQuery } from '@tanstack/react-query'
import { subscriptionService } from '@/services/SubscriptionService'

// In component:
const { data: usageStats } = useQuery({
  queryKey: ['usage-stats'],
  queryFn: () => subscriptionService.getSubscriptionStatus(),
  enabled: !!user,
})

// Display in sidebar:
{!isProUser && usageStats && (
  <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
    <div className="text-xs font-semibold text-amber-900 mb-1">
      Free Plan Usage
    </div>
    <div className="text-xs text-amber-700">
      {usageStats.attemptsUsed} / {usageStats.attemptsLimit} attempts used
    </div>
    {usageStats.attemptsUsed >= usageStats.attemptsLimit && (
      <div className="text-xs text-red-600 font-medium mt-1">
        Limit reached. Upgrade to continue.
      </div>
    )}
  </div>
)}
```

---

## Testing

### 1. Test Stripe Checkout (Test Mode)

1. Use Stripe test cards:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Any future expiry date, any CVC

2. Test webhook locally using Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/webhooks/stripe
   ```

3. Trigger test events:
   ```bash
   stripe trigger checkout.session.completed
   ```

### 2. Test Usage Limits

1. Create a free account
2. Make 5 AI requests
3. Verify 6th request is blocked
4. Upgrade to Pro
5. Verify unlimited access

### 3. Test Subscription Management

1. Upgrade to Pro
2. Access customer portal
3. Cancel subscription
4. Verify downgrade to Free

---

## Security Considerations

1. **Always verify webhook signatures** - Prevents fake webhook calls
2. **Use environment variables** - Never commit Stripe keys
3. **Validate user ownership** - Ensure users can only manage their own subscriptions
4. **Handle edge cases** - Expired subscriptions, failed payments, etc.
5. **Rate limit subscription endpoints** - Prevent abuse

---

## Next Steps

1. Set up Stripe webhook endpoint in production
2. Add email notifications for subscription events
3. Implement grace period for failed payments
4. Add analytics for subscription metrics
5. Consider annual plans or other pricing tiers

---

## Common Issues & Solutions

### Issue: Webhook not receiving events
- **Solution**: Ensure webhook endpoint is publicly accessible (use ngrok for local testing)
- Verify webhook secret matches Stripe dashboard
- For Fastify: Make sure raw body parsing is configured correctly

### Issue: User subscription not updating
- **Solution**: Check webhook logs in Stripe dashboard
- Verify `client_reference_id` or `metadata.userId` is set correctly
- Check database to ensure user record exists

### Issue: Usage count not incrementing
- **Solution**: Ensure `UsageGuard` is applied and `incrementAttempts` is called after successful operations
- Verify user's `subscriptionStatus` is being checked correctly

### Issue: Fastify raw body parsing for webhooks
- **Solution**: Install `@fastify/raw-body` and configure it:
  ```typescript
  // In main.ts or webhook controller setup
  import fastifyRawBody from '@fastify/raw-body';
  
  await app.register(fastifyRawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  });
  
  // Then in webhook controller, use req.rawBody instead of req.body
  ```

---

## Quick Reference: Key Files to Create/Modify

### Backend Files
- ✅ `backend/src/stripe/stripe.service.ts` - Stripe API wrapper
- ✅ `backend/src/subscriptions/subscriptions.module.ts` - Module definition
- ✅ `backend/src/subscriptions/subscriptions.service.ts` - Business logic
- ✅ `backend/src/subscriptions/subscriptions.controller.ts` - API endpoints
- ✅ `backend/src/subscriptions/webhook.controller.ts` - Webhook handler
- ✅ `backend/src/auth/auth.guard.ts` - Authentication guard (if needed)
- ✅ `backend/src/common/guards/usage.guard.ts` - Usage limit guard
- ✅ `backend/src/usage/usage.service.ts` - Usage tracking service
- ✅ `backend/prisma/schema.prisma` - Add subscription fields
- ✅ `backend/src/app.module.ts` - Register SubscriptionsModule

### Frontend Files
- ✅ `frontend/src/services/StripeService.ts` - Stripe.js wrapper
- ✅ `frontend/src/services/SubscriptionService.ts` - API calls
- ✅ `frontend/src/components/landing/Pricing.tsx` - Update button handlers
- ✅ `frontend/src/routes/subscription.success.tsx` - Success page
- ✅ `frontend/src/routes/subscription.cancel.tsx` - Cancel page
- ✅ `frontend/src/components/app-layout.tsx` - Show usage stats
- ✅ `frontend/.env` - Add Stripe publishable key

### Environment Variables Needed
```env
# Backend .env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO=price_...

# Frontend .env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

This guide provides a complete foundation for Stripe integration. Adapt the code to match your specific authentication and error handling patterns.

