import { Test, TestingModule } from '@nestjs/testing';
import { PdfService } from './pdf.service';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { PdfNotesQueue } from '../jobs/queues/pdf-notes.queue';
import { PdfUltraOptimizedQueue } from '../jobs/queues/pdf-ultra-optimized.queue';

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    const mockDatabaseService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      file: {
        create: jest.fn(),
      },
    } as unknown as DatabaseService;

    const mockConfigService = {
      get: (key: string) => {
        if (key === 'SUPABASE_URL') return 'http://localhost';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-key';
        return null;
      },
    } as unknown as ConfigService;

    const mockPdfNotesQueue = {
      add: jest.fn(),
    };

    const mockPdfUltraOptimizedQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PdfNotesQueue, useValue: mockPdfNotesQueue },
        { provide: PdfUltraOptimizedQueue, useValue: mockPdfUltraOptimizedQueue },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
