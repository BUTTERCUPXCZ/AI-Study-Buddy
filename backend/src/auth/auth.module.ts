import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseService } from 'src/database/database.service';
import { ConfigModule } from '@nestjs/config';
import { AuthGuard } from './auth.guard';
import { EmailVerifiedGuard } from './guards/email-verified.guard';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, DatabaseService, AuthGuard, EmailVerifiedGuard],
  exports: [AuthService, DatabaseService, AuthGuard, EmailVerifiedGuard],
})
export class AuthModule {}
