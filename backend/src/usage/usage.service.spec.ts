import { Test, TestingModule } from '@nestjs/testing';
import { UsageService } from './usage.service';
import { DatabaseService } from '../database/database.service';

describe('UsageService', () => {
  let service: UsageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        {
          provide: DatabaseService,
          useValue: {
            user: {
              findUnique: jest.fn().mockResolvedValue({
                subscriptionStatus: 'FREE',
                attemptsUsed: 0,
              }),
              update: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsageService>(UsageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
