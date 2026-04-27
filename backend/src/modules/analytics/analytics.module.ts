import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsWorkerService } from './analytics-worker.service';
import { HabitAnalytics } from './entities/habit-analytics.entity';
import { UserAnalytics } from './entities/user-analytics.entity';

@Module({
  imports: [TypeOrmModule.forFeature([HabitAnalytics, UserAnalytics])],
  controllers: [AnalyticsController],
  providers: [AnalyticsWorkerService, AnalyticsService],
  exports: [AnalyticsWorkerService],
})
export class AnalyticsModule {}
