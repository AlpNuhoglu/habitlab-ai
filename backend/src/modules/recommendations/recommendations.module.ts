import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { HabitAnalytics } from '../analytics/entities/habit-analytics.entity';
import { Recommendation } from './entities/recommendation.entity';
import { LlmCostService } from './llm-cost.service';
import { RecommendationRepository } from './recommendation.repository';
import { RecommendationWorkerService } from './recommendation-worker.service';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RuleEngineService } from './rule-engine.service';

@Module({
  imports: [TypeOrmModule.forFeature([Recommendation, HabitAnalytics])],
  providers: [
    RecommendationWorkerService,
    RecommendationsService,
    RecommendationRepository,
    RuleEngineService,
    LlmCostService,
  ],
  controllers: [RecommendationsController],
  exports: [RecommendationRepository],
})
export class RecommendationsModule {}
