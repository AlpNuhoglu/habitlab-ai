/**
 * Types shared between frontend and backend.
 *
 * This file contains only pure TypeScript types and enums — no runtime dependencies.
 * Backend DTOs (with class-validator) live in backend/src; OpenAPI-derived frontend
 * types live in frontend/src/api/generated.ts. This file is for the small set of
 * shared enum values and well-known constants.
 */

// Habit frequency — mirrors the Postgres enum `habit_frequency_type`
export const HABIT_FREQUENCY_TYPES = ['daily', 'weekly', 'custom'] as const;
export type HabitFrequencyType = (typeof HABIT_FREQUENCY_TYPES)[number];

// Habit-log status — mirrors the Postgres enum `habit_log_status`
export const HABIT_LOG_STATUSES = ['completed', 'skipped'] as const;
export type HabitLogStatus = (typeof HABIT_LOG_STATUSES)[number];

// Recommendation source
export const RECOMMENDATION_SOURCES = ['rule', 'ai'] as const;
export type RecommendationSource = (typeof RECOMMENDATION_SOURCES)[number];

// Recommendation status
export const RECOMMENDATION_STATUSES = ['active', 'dismissed', 'accepted', 'expired'] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

// Supported locales at launch
export const LOCALES = ['en', 'tr'] as const;
export type Locale = (typeof LOCALES)[number];
