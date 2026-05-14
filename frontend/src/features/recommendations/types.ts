// MOCK: generated.ts does not expose these schemas — hand-written from backend RecommendationDto.
// Update when backend OpenAPI spec is regenerated with full recommendation schema.

export type RecommendationCategory =
  | 'reschedule'
  | 'reduce_difficulty'
  | 'streak_celebration'
  | 'encouragement_after_skip'
  | 'consistency_reinforcement'
  | 'retroactive_logging_reminder';

export type RecommendationSource = 'rule' | 'ai';

export type RecommendationStatus = 'active' | 'accepted' | 'dismissed' | 'expired';

export type ActionPayload =
  | { readonly category: 'reschedule'; readonly preferredTime: string }
  | { readonly category: 'reduce_difficulty'; readonly targetDifficulty: number }
  | { readonly category: 'streak_celebration' }
  | { readonly category: 'encouragement_after_skip' }
  | { readonly category: 'consistency_reinforcement' }
  | { readonly category: 'retroactive_logging_reminder' };

export interface Recommendation {
  readonly id: string;
  readonly habitId: string | null;
  readonly category: RecommendationCategory;
  readonly source: RecommendationSource;
  readonly title: string;
  readonly body: string;
  readonly priority: number;
  readonly status: RecommendationStatus;
  readonly actionPayload: ActionPayload | null;
  readonly experimentVariant: string | null;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}

// Coach feature owns this type — exported from index.ts so the habits feature can subscribe
// without importing coach internals.
export interface HabitMutatedMessage {
  readonly type: 'HABIT_MUTATED';
  readonly habitId: string;
  readonly source: 'recommendation_accept';
  readonly fields: ReadonlyArray<'preferred_time' | 'difficulty'>;
}
