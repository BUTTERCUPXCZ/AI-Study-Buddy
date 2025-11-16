import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config/dist/config.module';

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, DatabaseModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
