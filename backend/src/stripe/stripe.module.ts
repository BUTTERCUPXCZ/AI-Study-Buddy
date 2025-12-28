import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Module({
  controllers: [],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
