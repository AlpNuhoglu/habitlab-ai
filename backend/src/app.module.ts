import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'path';

import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthController } from './common/health.controller';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { HabitsModule } from './modules/habits/habits.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';

// Subsequent feature modules will be uncommented in their respective WPs:
//   ExperimentsModule     ← WP8
//   NotificationsModule   ← WP9

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // __dirname is backend/src or backend/dist; two levels up = monorepo root.
      envFilePath: [resolve(__dirname, '../../.env.local'), resolve(__dirname, '../../.env')],
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
    HabitsModule,
    EventsModule,
    AnalyticsModule,
    RecommendationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
  ],
})
export class AppModule {}
