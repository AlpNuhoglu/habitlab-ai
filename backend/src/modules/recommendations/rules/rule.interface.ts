import type { HabitAnalytics } from '../../analytics/entities/habit-analytics.entity';

export interface RuleContext {
  userId: string;
  habitId: string;
  habitConfig: {
    difficulty: number;
    preferredTime: string | null;
    frequencyType: string;
  };
  habitAnalytics: HabitAnalytics;
  /** habit_logs for this habit from the past 7 days, ordered by log_date DESC */
  recentLogs: Array<{ logDate: string; status: 'completed' | 'skipped' }>;
}

export interface RuleResult {
  category: string;
  title: string;
  body: string;
  /** 0–100; higher = more important */
  priority: number;
  actionPayload?: Record<string, unknown>;
}

export interface IRule {
  evaluate(ctx: RuleContext): RuleResult | null;
}
