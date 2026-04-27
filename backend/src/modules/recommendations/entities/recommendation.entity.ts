import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type RecommendationSource = 'rule' | 'ai';
export type RecommendationStatus = 'active' | 'dismissed' | 'accepted' | 'expired';

@Entity('recommendations')
export class Recommendation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'habit_id', type: 'uuid', nullable: true })
  habitId!: string | null;

  @Column({ type: 'enum', enum: ['rule', 'ai'] as const })
  source!: RecommendationSource;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'action_payload', type: 'jsonb', nullable: true })
  actionPayload!: Record<string, unknown> | null;

  @Column({ type: 'smallint', default: 50 })
  priority!: number;

  @Column({ type: 'enum', enum: ['active', 'dismissed', 'accepted', 'expired'] as const, default: 'active' })
  status!: RecommendationStatus;

  @Column({ name: 'experiment_variant', type: 'text', nullable: true })
  experimentVariant!: string | null;

  // LLM telemetry — populated in WP7
  @Column({ name: 'llm_model', type: 'text', nullable: true })
  llmModel!: string | null;

  @Column({ name: 'llm_tokens_input', type: 'integer', nullable: true })
  llmTokensInput!: number | null;

  @Column({ name: 'llm_tokens_output', type: 'integer', nullable: true })
  llmTokensOutput!: number | null;

  @Column({ name: 'llm_cost_cents', type: 'numeric', precision: 10, scale: 4, nullable: true })
  llmCostCents!: number | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;
}
