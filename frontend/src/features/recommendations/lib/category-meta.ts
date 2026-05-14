import type { RecommendationCategory } from '../types';

export interface CategoryMeta {
  readonly emoji: string;
  readonly label: string;
  readonly accentClass: string;
  readonly acceptLabel: string;
}

export const CATEGORY_META: Record<RecommendationCategory, CategoryMeta> = {
  reschedule: {
    emoji: '⏰',
    label: 'Reschedule',
    accentClass: 'text-blue-600 bg-blue-50',
    acceptLabel: 'Move reminder',
  },
  reduce_difficulty: {
    emoji: '📉',
    label: 'Lower difficulty',
    accentClass: 'text-amber-600 bg-amber-50',
    acceptLabel: 'Lower difficulty',
  },
  streak_celebration: {
    emoji: '🔥',
    label: 'Streak',
    accentClass: 'text-orange-600 bg-orange-50',
    acceptLabel: 'Got it!',
  },
  encouragement_after_skip: {
    emoji: '💪',
    label: 'Encouragement',
    accentClass: 'text-rose-600 bg-rose-50',
    acceptLabel: 'Thanks!',
  },
  consistency_reinforcement: {
    emoji: '⭐',
    label: 'Consistency',
    accentClass: 'text-emerald-600 bg-emerald-50',
    acceptLabel: 'Keep going!',
  },
  retroactive_logging_reminder: {
    emoji: '📝',
    label: 'Log reminder',
    accentClass: 'text-violet-600 bg-violet-50',
    acceptLabel: 'Log now',
  },
};
