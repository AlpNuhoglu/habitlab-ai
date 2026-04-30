import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('experiment_assignments')
export class ExperimentAssignment {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @PrimaryColumn({ name: 'experiment_id', type: 'uuid' })
  experimentId!: string;

  @Column({ name: 'variant_key', type: 'text' })
  variantKey!: string;

  @Column({ name: 'assigned_at', type: 'timestamptz', default: () => 'now()' })
  assignedAt!: Date;
}
