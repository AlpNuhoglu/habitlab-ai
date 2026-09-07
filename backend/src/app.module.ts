import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { resolve } from 'path';

import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AppThrottlerGuard } from './common/throttler/app-throttler.guard';
import { AppThrottlerModule } from './common/throttler/app-throttler.module';
import { HealthController } from './common/health.controller';
import { DatabaseModule } from './infrastructure/database/database.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { HttpLoggingInterceptor } from './infrastructure/logger/http-logging.interceptor';
import { RequestIdMiddleware } from './infrastructure/logger/request-id.middleware';
import { MetricsInterceptor } from './infrastructure/metrics/metrics.interceptor';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { EventsModule } from './modules/events/events.module';
import { ExperimentsModule } from './modules/experiments/experiments.module';
import { HabitsModule } from './modules/habits/habits.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // __dirname is backend/src or backend/dist; two levels up = monorepo root.
      envFilePath: [resolve(__dirname, '../../.env.local'), resolve(__dirname, '../../.env')],
      cache: true,
    }),
    DatabaseModule,
    InfrastructureModule,
    AppThrottlerModule,
    AuthModule,
    HabitsModule,
    EventsModule,
    AnalyticsModule,
    ExperimentsModule,
    RecommendationsModule,
    ChatModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: global guards run in registration order. The throttler
    // must run before auth so the default tier protects authenticated routes
    // and a valid-token flood is still rate limited.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
