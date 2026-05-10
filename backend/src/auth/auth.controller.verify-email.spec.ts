import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditService } from '../common/services/audit.service';

/**
 * Integration tests for POST /auth/verify-email/callback. We use the real
 * controller wired against a stubbed AuthService + AuditService so the
 * supertest layer exercises status codes, body shape, and audit emission
 * end-to-end without touching Supabase or Postgres.
 */
describe('AuthController — POST /auth/verify-email/callback', () => {
  let app: INestApplication;
  let authService: { confirmEmailVerification: jest.Mock };
  let auditService: { record: jest.Mock };

  beforeEach(async () => {
    authService = { confirmEmailVerification: jest.fn() };
    auditService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    app = module.createNestApplication();
    // Match the global pipe set up in main.ts so DTO behaviour matches prod.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects an empty body with 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/verify-email/callback')
      .send({});

    expect(res.status).toBe(400);
    const body = res.body as { message?: string };
    expect(body.message).toContain('Access token is required');
    expect(authService.confirmEmailVerification).not.toHaveBeenCalled();
    expect(auditService.record).not.toHaveBeenCalled();
  });

  it('returns 401 + records email_verify_failed when the service rejects an invalid token', async () => {
    authService.confirmEmailVerification.mockRejectedValue(
      new UnauthorizedException('Invalid or expired verification token'),
    );

    const res = await request(app.getHttpServer())
      .post('/auth/verify-email/callback')
      .send({ access_token: 'tampered' });

    expect(res.status).toBe(401);
    expect(auditService.record).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'email_verify_failed',
        target: 'UnauthorizedException',
      }),
    );
  });

  it('returns 400 + records email_verify_failed when supabase has not confirmed the email', async () => {
    authService.confirmEmailVerification.mockRejectedValue(
      new BadRequestException('Email not yet confirmed by Supabase'),
    );

    const res = await request(app.getHttpServer())
      .post('/auth/verify-email/callback')
      .send({ access_token: 'unconfirmed' });

    expect(res.status).toBe(400);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'email_verify_failed',
        target: 'BadRequestException',
      }),
    );
  });

  it('returns 200 + records email_verified on the happy path', async () => {
    authService.confirmEmailVerification.mockResolvedValue({
      message: 'Email verified successfully. You can now log in.',
      userId: 'local-1',
    });

    const res = await request(app.getHttpServer())
      .post('/auth/verify-email/callback')
      .send({ access_token: 'good-token' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      message: 'Email verified successfully. You can now log in.',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'email_verified',
        userId: 'local-1',
      }),
    );
  });

  it('returns 200 with "already verified" message on idempotent re-call', async () => {
    authService.confirmEmailVerification.mockResolvedValue({
      message: 'Email already verified',
      userId: 'local-1',
    });

    const res = await request(app.getHttpServer())
      .post('/auth/verify-email/callback')
      .send({ access_token: 'reused-token' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Email already verified' });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'email_verified' }),
    );
  });
});
