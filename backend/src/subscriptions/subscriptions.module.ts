import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { StripeService } from 'src/stripe/stripe.service';
import { DatabaseService } from 'src/database/database.service';
import { AuthService } from 'src/auth/auth.service';
import { WebhookController } from './webhook.controller';

@Module({
  controllers: [SubscriptionsController, WebhookController],
  providers: [
    SubscriptionsService,
    StripeService,
    DatabaseService,
    AuthService,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
