import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { UserScopedRepository } from '../../common/repositories/user-scoped.repository';
import type { RecommendationStatus } from './entities/recommendation.entity';
import { Recommendation } from './entities/recommendation.entity';

interface InsertData {
  userId: string;
  habitId: string | null;
  category: string;
  title: string;
  body: string;
  priority: number;
  actionPayload: Record<string, unknown> | null;
  source?: 'rule' | 'ai';
  llmModel?: string | undefined;
  llmTokensInput?: number | undefined;
  llmTokensOutput?: number | undefined;
  llmCostCents?: number | undefined;
}

@Injectable()
export class RecommendationRepository extends UserScopedRepository<Recommendation> {
  constructor(
    @InjectRepository(Recommendation)
    protected readonly repo: Repository<Recommendation>,
  ) {
    super();
  }

  async findActive(userId: string, em?: EntityManager): Promise<Recommendation[]> {
    const r = em ? em.getRepository(Recommendation) : this.repo;
    return r
      .createQueryBuilder('r')
      .where('r.userId = :userId', { userId })
      .andWhere('r.status = :status', { status: 'active' })
      .andWhere('(r.expiresAt IS NULL OR r.expiresAt > NOW())')
      .orderBy('r.priority', 'DESC')
      .addOrderBy('r.createdAt', 'DESC')
      .limit(10)
      .getMany();
  }

  async findById(id: string, userId: string, em?: EntityManager): Promise<Recommendation | null> {
    const r = em ? em.getRepository(Recommendation) : this.repo;
    return r.findOne({ where: { id, userId } });
  }

  async hasCooldownActive(
    userId: string,
    habitId: string,
    category: string,
    em: EntityManager,
  ): Promise<boolean> {
    const rows = await em.query<Array<{ id: string }>>(
      `SELECT id FROM recommendations
       WHERE user_id = $1
         AND habit_id = $2
         AND category = $3
         AND created_at >= NOW() - INTERVAL '14 days'
       LIMIT 1`,
      [userId, habitId, category],
    );
    return rows.length > 0;
  }

  async insert(data: InsertData, em: EntityManager): Promise<Recommendation> {
    const source = data.source ?? 'rule';
    const rows = await em.query<Array<Record<string, unknown>>>(
      `INSERT INTO recommendations
         (user_id, habit_id, source, category, title, body, priority, action_payload,
          llm_model, llm_tokens_input, llm_tokens_output, llm_cost_cents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        data.userId,
        data.habitId,
        source,
        data.category,
        data.title,
        data.body,
        data.priority,
        data.actionPayload !== null ? JSON.stringify(data.actionPayload) : null,
        data.llmModel ?? null,
        data.llmTokensInput ?? null,
        data.llmTokensOutput ?? null,
        data.llmCostCents ?? null,
      ],
    );
    if (!rows[0]) throw new Error('INSERT returned no row');
    return this.mapRow(rows[0]);
  }

  async setStatus(
    id: string,
    userId: string,
    status: RecommendationStatus,
    em: EntityManager,
  ): Promise<void> {
    await em.query(
      `UPDATE recommendations
       SET status = $1, resolved_at = NOW()
       WHERE id = $2 AND user_id = $3`,
      [status, id, userId],
    );
  }

  private mapRow(row: Record<string, unknown>): Recommendation {
    const rec = new Recommendation();
    rec.id = row['id'] as string;
    rec.userId = row['user_id'] as string;
    rec.habitId = (row['habit_id'] as string | null) ?? null;
    rec.source = row['source'] as 'rule' | 'ai';
    rec.category = row['category'] as string;
    rec.title = row['title'] as string;
    rec.body = row['body'] as string;
    rec.actionPayload = (row['action_payload'] as Record<string, unknown> | null) ?? null;
    rec.priority = row['priority'] as number;
    rec.status = row['status'] as RecommendationStatus;
    rec.experimentVariant = (row['experiment_variant'] as string | null) ?? null;
    rec.llmModel = (row['llm_model'] as string | null) ?? null;
    rec.llmTokensInput = (row['llm_tokens_input'] as number | null) ?? null;
    rec.llmTokensOutput = (row['llm_tokens_output'] as number | null) ?? null;
    rec.llmCostCents = (row['llm_cost_cents'] as number | null) ?? null;
    rec.expiresAt = row['expires_at'] ? new Date(row['expires_at'] as string) : null;
    rec.createdAt = new Date(row['created_at'] as string);
    rec.resolvedAt = row['resolved_at'] ? new Date(row['resolved_at'] as string) : null;
    return rec;
  }
}
