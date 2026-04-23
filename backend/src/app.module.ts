import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { HealthController } from './common/health.controller';

/**
 * Root application module.
 *
 * Feature modules (Auth, Habits, Events, Analytics, Experiments, Recommendations,
 * Notifications) are imported here as they're built in each work package.
 *
 * See docs/HabitLab_AI_Analysis_Report.docx §3.3.2 for the module boundary rules.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    // TypeOrmModule.forRootAsync(...)   ← added in WP2
    // AuthModule                         ← added in WP2
    // HabitsModule                       ← added in WP3
    // EventsModule                       ← added in WP4
    // AnalyticsModule                    ← added in WP5
    // RecommendationsModule              ← added in WP6
    // ExperimentsModule                  ← added in WP8
    // NotificationsModule                ← added in WP9
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
