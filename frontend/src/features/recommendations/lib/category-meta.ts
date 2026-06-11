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
    accentClass: 'border border-cyan-500/40 bg-cyan-900/20 text-cyan-400',
    acceptLabel: 'Move reminder',
  },
  reduce_difficulty: {
    emoji: '📉',
    label: 'Lower difficulty',
    accentClass: 'border border-amber-500/40 bg-amber-900/20 text-amber-400',
    acceptLabel: 'Lower difficulty',
  },
  streak_celebration: {
    emoji: '🔥',
    label: 'Streak',
    accentClass: 'border border-orange-500/40 bg-orange-900/20 text-orange-400',
    acceptLabel: 'Got it!',
  },
  encouragement_after_skip: {
    emoji: '💪',
    label: 'Encouragement',
    accentClass: 'border border-fuchsia-500/40 bg-fuchsia-900/20 text-fuchsia-400',
    acceptLabel: 'Thanks!',
  },
  consistency_reinforcement: {
    emoji: '⭐',
    label: 'Consistency',
    accentClass: 'border border-emerald-500/40 bg-emerald-900/20 text-emerald-400',
    acceptLabel: 'Keep going!',
  },
  retroactive_logging_reminder: {
    emoji: '📝',
    label: 'Log reminder',
    accentClass: 'border border-purple-500/40 bg-purple-900/20 text-purple-400',
    acceptLabel: 'Log now',
  },
};
