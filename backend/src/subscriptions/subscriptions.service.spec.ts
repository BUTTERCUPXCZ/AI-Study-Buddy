import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from 'src/stripe/stripe.service';
import { DatabaseService } from 'src/database/database.service';
import { ConfigService } from '@nestjs/config';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        // Mock dependencies
        {
          provide: StripeService,
          useValue: {
            getOrCreateCustomer: jest
              .fn()
              .mockResolvedValue({ id: 'cust_123', email: 'test@example.com' }),
            createCheckoutSession: jest
              .fn()
              .mockResolvedValue({ id: 'sess_123', url: 'https://checkout' }),
            retrieveCheckoutSession: jest
              .fn()
              .mockResolvedValue({ id: 'sess_123', payment_status: 'paid' }),
            createPortalSession: jest
              .fn()
              .mockResolvedValue({ url: 'https://portal' }),
            getSubscriptionById: jest.fn(),
            cancelSubscription: jest.fn(),
          },
        },
        {
          provide: DatabaseService,
          useValue: {
            user: {
              findUnique: jest
                .fn()
                .mockResolvedValue({ id: 'user_1', email: 'test@example.com' }),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'STRIPE_PRICE_ID_PRO') return 'price_123';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
