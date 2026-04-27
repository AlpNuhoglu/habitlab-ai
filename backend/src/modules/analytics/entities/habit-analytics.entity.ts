import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('habit_analytics')
export class HabitAnalytics {
  @PrimaryColumn({ name: 'habit_id', type: 'uuid' })
  habitId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'current_streak', type: 'int' })
  currentStreak!: number;

  @Column({ name: 'longest_streak', type: 'int' })
  longestStreak!: number;

  @Column({ name: 'completion_rate_7d', type: 'numeric', precision: 5, scale: 4 })
  completionRate7d!: number;

  @Column({ name: 'completion_rate_30d', type: 'numeric', precision: 5, scale: 4 })
  completionRate30d!: number;

  @Column({ name: 'completion_rate_90d', type: 'numeric', precision: 5, scale: 4 })
  completionRate90d!: number;

  // 7-element array, index 0 = Monday, index 6 = Sunday
  @Column({ name: 'completion_by_weekday', type: 'jsonb' })
  completionByWeekday!: number[];

  // 24-element array, index = hour 0..23 in user's local timezone
  @Column({ name: 'completion_by_hour', type: 'jsonb' })
  completionByHour!: number[];

  @Column({ name: 'last_completed_at', type: 'timestamptz', nullable: true })
  lastCompletedAt!: Date | null;

  @Column({ name: 'last_skipped_at', type: 'timestamptz', nullable: true })
  lastSkippedAt!: Date | null;

  @Column({ name: 'recomputed_at', type: 'timestamptz' })
  recomputedAt!: Date;
}
