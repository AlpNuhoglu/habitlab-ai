import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { Recommendation } from './entities/recommendation.entity';
import { RecommendationRepository } from './recommendation.repository';

export interface RecommendationDto {
  id: string;
  title: string;
  body: string;
  source: string;
  category: string;
  actionPayload: Record<string, unknown> | null;
  priority: number;
  habitId: string | null;
  experimentVariant: string | null;
  createdAt: string;
  expiresAt: string | null;
}

function toDto(rec: Recommendation): RecommendationDto {
  return {
    id: rec.id,
    title: rec.title,
    body: rec.body,
    source: rec.source,
    category: rec.category,
    actionPayload: rec.actionPayload,
    priority: rec.priority,
    habitId: rec.habitId,
    experimentVariant: rec.experimentVariant,
    createdAt: rec.createdAt.toISOString(),
    expiresAt: rec.expiresAt?.toISOString() ?? null,
  };
}

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly recRepo: RecommendationRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async listActive(userId: string): Promise<RecommendationDto[]> {
    const recs = await this.recRepo.findActive(userId);
    return recs.map(toDto);
  }

  async dismiss(id: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const rec = await this.recRepo.findById(id, userId, em);
      if (!rec) throw new NotFoundException('Recommendation not found');

      await this.recRepo.setStatus(id, userId, 'dismissed', em);

      await em.query(
        `INSERT INTO events (user_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, 'recommendation.dismissed', 'recommendation', $2, $3)`,
        [userId, id, JSON.stringify({ category: rec.category, habitId: rec.habitId })],
      );
    });
  }

  async accept(id: string, userId: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      const rec = await this.recRepo.findById(id, userId, em);
      if (!rec) throw new NotFoundException('Recommendation not found');

      await this.recRepo.setStatus(id, userId, 'accepted', em);

      // Apply action_payload for reschedule recommendations
      if (
        rec.category === 'reschedule' &&
        rec.habitId &&
        rec.actionPayload &&
        typeof rec.actionPayload['preferred_time'] === 'string'
      ) {
        await em.query(`UPDATE habits SET preferred_time = $1 WHERE id = $2 AND user_id = $3`, [
          rec.actionPayload['preferred_time'],
          rec.habitId,
          userId,
        ]);
      }

      await em.query(
        `INSERT INTO events (user_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, 'recommendation.accepted', 'recommendation', $2, $3)`,
        [userId, id, JSON.stringify({ category: rec.category, habitId: rec.habitId })],
      );
    });
  }
}
