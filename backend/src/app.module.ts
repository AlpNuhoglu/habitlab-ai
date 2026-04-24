import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './common/health.controller';
import { AuthModule } from './modules/auth/auth.module';

// Subsequent feature modules will be uncommented in their respective WPs:
//   HabitsModule          ← WP3
//   EventsModule          ← WP4
//   AnalyticsModule       ← WP5
//   RecommendationsModule ← WP6
//   ExperimentsModule     ← WP8
//   NotificationsModule   ← WP9

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: config.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
