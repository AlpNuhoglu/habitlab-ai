import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('user_analytics')
export class UserAnalytics {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'completion_rate_7d', type: 'numeric', precision: 5, scale: 4 })
  completionRate7d!: number;

  @Column({ name: 'completion_rate_30d', type: 'numeric', precision: 5, scale: 4 })
  completionRate30d!: number;

  @Column({ name: 'completion_rate_all_time', type: 'numeric', precision: 5, scale: 4 })
  completionRateAllTime!: number;

  @Column({ name: 'longest_streak', type: 'int' })
  longestStreak!: number;

  @Column({ name: 'current_longest_streak', type: 'int' })
  currentLongestStreak!: number;

  @Column({ name: 'best_hour_of_day', type: 'smallint', nullable: true })
  bestHourOfDay!: number | null;

  @Column({ name: 'worst_hour_of_day', type: 'smallint', nullable: true })
  worstHourOfDay!: number | null;

  @Column({ name: 'best_weekday', type: 'smallint', nullable: true })
  bestWeekday!: number | null;

  @Column({ name: 'worst_weekday', type: 'smallint', nullable: true })
  worstWeekday!: number | null;

  @Column({ name: 'total_logs_30d', type: 'int' })
  totalLogs30d!: number;

  @Column({ name: 'total_completions_30d', type: 'int' })
  totalCompletions30d!: number;

  @Column({ name: 'total_skips_30d', type: 'int' })
  totalSkips30d!: number;

  @Column({ name: 'recomputed_at', type: 'timestamptz' })
  recomputedAt!: Date;
}
