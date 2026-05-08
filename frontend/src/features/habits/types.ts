// MOCK: hand-written until backend adds @ApiResponse decorators to generated.ts

export interface Habit {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly description: string | null;
  readonly frequencyType: 'daily' | 'weekly' | 'custom';
  readonly weekdayMask: number | null;
  readonly targetCountPerWeek: number | null;
  readonly preferredTime: string | null; // HH:MM
  readonly difficulty: number; // 1–5
  readonly isActive: boolean;
  readonly archivedAt: string | null;
  readonly currentStreak: number;
  readonly completionRate30d: number;
  readonly todayStatus: 'completed' | 'skipped' | 'pending' | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HabitLog {
  readonly id: string;
  readonly habitId: string;
  readonly logDate: string; // YYYY-MM-DD
  readonly status: 'completed' | 'skipped';
  readonly note: string | null;
  readonly loggedAt: string;
}

/** One cell in the calendar heatmap — status is null when no log was recorded. */
export interface CalendarDay {
  readonly date: string; // YYYY-MM-DD
  readonly status: 'completed' | 'skipped' | null;
}

export interface HabitAnalytics {
  readonly completionRate30d: number;
  readonly completionRate7d: number;
  readonly completionRateAllTime: number;
  readonly currentStreak: number;
  readonly longestStreak: number;
  readonly completionByHour: number[]; // index = hour 0–23
  readonly completionByWeekday: number[]; // index 0=Mon … 6=Sun
  readonly bestHour: number | null;
  readonly bestWeekday: number | null; // 0=Mon … 6=Sun
  readonly monthlyTrend: ReadonlyArray<{ readonly month: string; readonly rate: number }>;
}

export interface Recommendation {
  readonly id: string;
  readonly habitId: string;
  readonly category: string;
  readonly status: 'active' | 'accepted' | 'dismissed' | 'expired';
  readonly title: string;
  readonly body: string;
  readonly priority: number;
  readonly source: 'rule' | 'ai';
  readonly actionPayload: unknown;
  readonly experimentVariant: string | null;
  readonly createdAt: string;
}

/** Leaner habit shape returned by the dashboard endpoint. */
export interface DashboardHabit {
  readonly id: string;
  readonly name: string;
  readonly frequencyType: string;
  readonly preferredTime: string | null;
  readonly currentStreak: number;
  readonly completionRate30d: number;
  readonly todayStatus: 'completed' | 'skipped' | 'pending';
}

/** Recommendation shape returned by the dashboard endpoint. */
export interface DashboardRecommendation {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly category: string;
  readonly priority: number;
  readonly habitId: string | null;
  readonly actionPayload: Record<string, unknown> | null;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}

export interface DashboardStats {
  readonly activeHabits: number;
  readonly todayCompleted: number;
  readonly todaySkipped: number;
  readonly todayPending: number;
  readonly overallCompletionRate30d: number;
  readonly longestStreakAnyHabit: number;
}

/** Matches the shape of GET /api/v1/dashboard exactly. */
export interface DashboardSummary {
  readonly summary: DashboardStats;
  readonly habits: DashboardHabit[];
  readonly activeRecommendations: DashboardRecommendation[];
}

// ── UI-layer contracts ──────────────────────────────────────────────────────

export type HabitColor = 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';

export interface HabitListFilters {
  readonly status: 'all' | 'active' | 'archived';
  readonly sort: 'name-asc' | 'name-desc' | 'created-desc' | 'streak-desc';
}

export interface ToggleLogContext {
  readonly snapshotDetail: Habit | undefined;
  readonly snapshotDashboard: DashboardSummary | undefined;
  readonly action: 'log' | 'unlog';
  readonly date: string;
}

/** Minimal habit interface needed by HabitCheckbox. */
export interface CheckableHabit {
  readonly id: string;
  readonly name: string;
  readonly todayStatus: 'completed' | 'skipped' | 'pending' | null;
}
