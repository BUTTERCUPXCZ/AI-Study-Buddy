import { Test, TestingModule } from '@nestjs/testing';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';

describe('PdfController', () => {
  let controller: PdfController;

  beforeEach(async () => {
    const mockDatabaseService = {
      file: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    } as unknown as DatabaseService;

    const mockConfigService = {
      get: (key: string) => {
        if (key === 'SUPABASE_URL') return 'http://localhost';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-key';
        return null;
      },
    } as unknown as ConfigService;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PdfController],
      providers: [
        PdfService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    controller = module.get<PdfController>(PdfController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
