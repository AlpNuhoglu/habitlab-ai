import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { ExperimentAssignment } from './entities/experiment-assignment.entity';
import { Experiment } from './entities/experiment.entity';
import type { ExperimentStatus, ExperimentVariant } from './entities/experiment.entity';

export interface CreateExperimentData {
  key: string;
  name: string;
  description?: string;
  variants: ExperimentVariant[];
  primaryMetric: string;
  guardrailMetrics?: string[];
  startsAt?: Date;
  endsAt?: Date;
}

@Injectable()
export class ExperimentRepository {
  constructor(
    @InjectRepository(Experiment)
    private readonly experimentRepo: Repository<Experiment>,
    @InjectRepository(ExperimentAssignment)
    private readonly assignmentRepo: Repository<ExperimentAssignment>,
  ) {}

  async findActive(em?: EntityManager): Promise<Experiment[]> {
    const r = em ? em.getRepository(Experiment) : this.experimentRepo;
    return r.find({ where: { status: 'running' } });
  }

  async findByKey(key: string, em?: EntityManager): Promise<Experiment | null> {
    const r = em ? em.getRepository(Experiment) : this.experimentRepo;
    return r.findOne({ where: { key } });
  }

  async findByKeyAndStatuses(
    key: string,
    statuses: ExperimentStatus[],
    em?: EntityManager,
  ): Promise<Experiment | null> {
    const r = em ? em.getRepository(Experiment) : this.experimentRepo;
    return r
      .createQueryBuilder('e')
      .where('e.key = :key', { key })
      .andWhere('e.status IN (:...statuses)', { statuses })
      .getOne();
  }

  async findAssignment(
    userId: string,
    experimentId: string,
    em?: EntityManager,
  ): Promise<ExperimentAssignment | null> {
    const r = em ? em.getRepository(ExperimentAssignment) : this.assignmentRepo;
    return r.findOne({ where: { userId, experimentId } });
  }

  async createAssignment(
    userId: string,
    experimentId: string,
    variantKey: string,
    em: EntityManager,
  ): Promise<void> {
    await em.query(
      `INSERT INTO experiment_assignments (user_id, experiment_id, variant_key)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [userId, experimentId, variantKey],
    );
  }

  async updateStatus(key: string, status: ExperimentStatus, em: EntityManager): Promise<void> {
    await em.query(
      `UPDATE experiments SET status = $1, updated_at = now() WHERE key = $2`,
      [status, key],
    );
  }

  async create(data: CreateExperimentData, em: EntityManager): Promise<Experiment> {
    const rows = await em.query<Array<Record<string, unknown>>>(
      `INSERT INTO experiments
         (key, name, description, variants, primary_metric, guardrail_metrics, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        data.key,
        data.name,
        data.description ?? null,
        JSON.stringify(data.variants),
        data.primaryMetric,
        JSON.stringify(data.guardrailMetrics ?? []),
        data.startsAt ?? null,
        data.endsAt ?? null,
      ],
    );
    if (!rows[0]) throw new Error('INSERT returned no row');
    return this.mapRow(rows[0]);
  }

  private mapRow(row: Record<string, unknown>): Experiment {
    const e = new Experiment();
    e.id = row['id'] as string;
    e.key = row['key'] as string;
    e.name = row['name'] as string;
    e.description = (row['description'] as string | null) ?? null;
    e.variants = row['variants'] as ExperimentVariant[];
    e.primaryMetric = row['primary_metric'] as string;
    e.guardrailMetrics = (row['guardrail_metrics'] as string[]) ?? [];
    e.status = row['status'] as ExperimentStatus;
    e.startsAt = row['starts_at'] ? new Date(row['starts_at'] as string) : null;
    e.endsAt = row['ends_at'] ? new Date(row['ends_at'] as string) : null;
    e.createdAt = new Date(row['created_at'] as string);
    e.updatedAt = new Date(row['updated_at'] as string);
    return e;
  }
}
