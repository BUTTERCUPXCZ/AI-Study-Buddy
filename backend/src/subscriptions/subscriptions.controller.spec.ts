import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { AuthGuard } from 'src/auth/auth.guard';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        // Provide a mock SubscriptionsService so the controller can be instantiated
        {
          provide: SubscriptionsService,
          useValue: {
            createCheckoutSession: jest.fn(),
            retrieveSession: jest.fn(),
            handleSubscriptionCreated: jest.fn(),
            getUserSubscription: jest.fn(),
            createPortalSession: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
