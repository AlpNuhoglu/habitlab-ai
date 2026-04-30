import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

export interface ExperimentVariant {
  key: string;
  weight: number;
  config?: Record<string, unknown>;
}

@Entity('experiments')
export class Experiment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true })
  key!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'jsonb' })
  variants!: ExperimentVariant[];

  @Column({ name: 'primary_metric', type: 'text' })
  primaryMetric!: string;

  @Column({ name: 'guardrail_metrics', type: 'jsonb', default: () => "'[]'" })
  guardrailMetrics!: string[];

  @Column({ type: 'enum', enum: ['draft', 'running', 'paused', 'completed', 'archived'], default: 'draft' })
  status!: ExperimentStatus;

  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt!: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;
}
