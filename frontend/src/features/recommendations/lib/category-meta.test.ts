import { describe, it, expect } from 'vitest';
import { CATEGORY_META } from './category-meta';
import type { RecommendationCategory } from '../types';

const ALL_CATEGORIES: RecommendationCategory[] = [
  'reschedule',
  'reduce_difficulty',
  'streak_celebration',
  'encouragement_after_skip',
  'consistency_reinforcement',
  'retroactive_logging_reminder',
];

describe('CATEGORY_META', () => {
  it('covers all 6 categories', () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CATEGORY_META[cat]).toBeDefined();
    }
  });

  it('every entry has emoji, label, accentClass, acceptLabel', () => {
    for (const cat of ALL_CATEGORIES) {
      const meta = CATEGORY_META[cat];
      expect(meta.emoji.length).toBeGreaterThan(0);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.accentClass.length).toBeGreaterThan(0);
      expect(meta.acceptLabel.length).toBeGreaterThan(0);
    }
  });

  it('reschedule acceptLabel is Move reminder', () => {
    expect(CATEGORY_META['reschedule'].acceptLabel).toBe('Move reminder');
  });
});
