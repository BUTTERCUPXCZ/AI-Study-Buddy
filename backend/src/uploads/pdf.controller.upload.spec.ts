import { Test, TestingModule } from '@nestjs/testing';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { BadRequestException } from '@nestjs/common';

describe('PdfController - Upload Tests', () => {
  let controller: PdfController;

  const mockPdfService = {
    uploadPdf: jest.fn(),
    findAllByUser: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PdfController],
      providers: [
        {
          provide: PdfService,
          useValue: mockPdfService,
        },
      ],
    }).compile();

    controller = module.get<PdfController>(PdfController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('uploadPdf', () => {
    it('should upload a PDF successfully', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('test'),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        stream: null as unknown as any,
        destination: '',
        filename: '',
        path: '',
      } as unknown as Express.Multer.File;

      const createPdfDto = {
        userId: 'user123',
        fileName: 'test.pdf',
      };

      const expectedResult = {
        id: 'file123',
        url: 'https://supabase.co/storage/pdfs/test.pdf',
        name: 'test.pdf',
        userId: 'user123',
        message: 'File uploaded successfully',
      };

      mockPdfService.uploadPdf.mockResolvedValue(expectedResult);

      const result = await controller.uploadPdf(mockFile, createPdfDto);

      expect(result).toEqual(expectedResult);
      expect(mockPdfService.uploadPdf).toHaveBeenCalledWith(
        mockFile,
        createPdfDto,
      );
    });

    it('should throw BadRequestException when no file is provided', async () => {
      const createPdfDto = {
        userId: 'user123',
        fileName: 'test.pdf',
      };

      await expect(
        controller.uploadPdf(
          null as unknown as Express.Multer.File,
          createPdfDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
