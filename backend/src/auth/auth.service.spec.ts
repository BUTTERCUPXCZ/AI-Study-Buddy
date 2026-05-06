import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseService } from '../database/database.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../common/services/audit.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockDatabaseService: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    file: { create: jest.Mock };
  };
  let supabaseGetUser: jest.Mock;

  beforeEach(async () => {
    mockDatabaseService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      file: {
        create: jest.fn(),
      },
    };

    const mockConfigService = {
      get: (key: string) => {
        if (key === 'SUPABASE_URL') return 'http://localhost';
        if (key === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-key';
        if (key === 'FRONTEND_URL') return 'http://localhost:5173';
        return null;
      },
    } as unknown as ConfigService;

    const mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
    } as unknown as RedisService;

    const mockAuditService = {
      record: jest.fn(),
    } as unknown as AuditService;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService as unknown as DatabaseService,
        },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Replace the real Supabase client created by the constructor with a
    // mock so tests don't touch the network. We only stub the calls the
    // tested methods reach for.
    supabaseGetUser = jest.fn();
    (
      service as unknown as { supabase: { auth: { getUser: jest.Mock } } }
    ).supabase = {
      auth: { getUser: supabaseGetUser },
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('confirmEmailVerification', () => {
    it('throws UnauthorizedException when supabase.auth.getUser returns an error', async () => {
      supabaseGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'invalid jwt' },
      });

      await expect(
        service.confirmEmailVerification('bad-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
      expect(mockDatabaseService.user.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when email_confirmed_at is missing', async () => {
      supabaseGetUser.mockResolvedValue({
        data: {
          user: { id: 'sb-123', email_confirmed_at: null },
        },
        error: null,
      });

      await expect(
        service.confirmEmailVerification('valid-but-unconfirmed'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockDatabaseService.user.findUnique).not.toHaveBeenCalled();
      expect(mockDatabaseService.user.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when local user is missing', async () => {
      supabaseGetUser.mockResolvedValue({
        data: {
          user: { id: 'sb-123', email_confirmed_at: '2026-01-01T00:00:00Z' },
        },
        error: null,
      });
      mockDatabaseService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.confirmEmailVerification('valid-token'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockDatabaseService.user.findUnique).toHaveBeenCalledWith({
        where: { supabaseId: 'sb-123' },
      });
      expect(mockDatabaseService.user.update).not.toHaveBeenCalled();
    });

    it('returns "already verified" without writing when emailVerified is true', async () => {
      supabaseGetUser.mockResolvedValue({
        data: {
          user: { id: 'sb-123', email_confirmed_at: '2026-01-01T00:00:00Z' },
        },
        error: null,
      });
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: 'local-1',
        emailVerified: true,
      });

      const result = await service.confirmEmailVerification('valid-token');

      expect(result).toEqual({
        message: 'Email already verified',
        userId: 'local-1',
      });
      expect(mockDatabaseService.user.update).not.toHaveBeenCalled();
    });

    it('flips emailVerified=true on the happy path and returns userId', async () => {
      supabaseGetUser.mockResolvedValue({
        data: {
          user: { id: 'sb-123', email_confirmed_at: '2026-01-01T00:00:00Z' },
        },
        error: null,
      });
      mockDatabaseService.user.findUnique.mockResolvedValue({
        id: 'local-1',
        emailVerified: false,
      });
      mockDatabaseService.user.update.mockResolvedValue({
        id: 'local-1',
        emailVerified: true,
      });

      const result = await service.confirmEmailVerification('valid-token');

      expect(mockDatabaseService.user.update).toHaveBeenCalledWith({
        where: { id: 'local-1' },
        data: { emailVerified: true },
      });
      expect(result).toEqual({
        message: 'Email verified successfully. You can now log in.',
        userId: 'local-1',
      });
    });
  });
});
