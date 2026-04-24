import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HabitFrequencyType = 'daily' | 'weekly' | 'custom';

@Entity('habits')
@Check('habits_name_length', `char_length(name) BETWEEN 1 AND 120`)
@Check('habits_description_length', `description IS NULL OR char_length(description) <= 500`)
@Check('habits_difficulty_range', `difficulty BETWEEN 1 AND 5`)
@Check('habits_weekday_mask_range', `weekday_mask IS NULL OR weekday_mask BETWEEN 0 AND 127`)
@Check('habits_target_per_week_range', `target_count_per_week IS NULL OR target_count_per_week BETWEEN 1 AND 7`)
@Check('habits_weekly_requires_mask', `frequency_type <> 'weekly' OR weekday_mask IS NOT NULL`)
@Check('habits_custom_requires_target', `frequency_type <> 'custom' OR target_count_per_week IS NOT NULL`)
export class Habit {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'frequency_type',
    type: 'enum',
    enum: ['daily', 'weekly', 'custom'],
  })
  frequencyType!: HabitFrequencyType;

  @Column({ name: 'weekday_mask', type: 'smallint', nullable: true })
  weekdayMask!: number | null;

  @Column({ name: 'target_count_per_week', type: 'smallint', nullable: true })
  targetCountPerWeek!: number | null;

  // TIME column — stored as 'HH:MM:SS'; we expose as 'HH:MM'
  @Column({ name: 'preferred_time', type: 'time', nullable: true })
  preferredTime!: string | null;

  @Column({ type: 'smallint', default: 3 })
  difficulty!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
