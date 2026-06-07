import { describe, it, expect } from 'vitest';
import { streakBonusMultiplier } from './streak-bonus';

describe('streakBonusMultiplier', () => {
  it('returns 1.0 for streaks below 7 days', () => {
    expect(streakBonusMultiplier(0)).toBe(1.0);
    expect(streakBonusMultiplier(6)).toBe(1.0);
  });

  it('returns 1.5 at exactly 7 days', () => {
    expect(streakBonusMultiplier(7)).toBe(1.5);
  });

  it('returns 1.5 for streaks between 7 and 29 days', () => {
    expect(streakBonusMultiplier(14)).toBe(1.5);
    expect(streakBonusMultiplier(29)).toBe(1.5);
  });

  it('returns 2.0 at exactly 30 days', () => {
    expect(streakBonusMultiplier(30)).toBe(2.0);
  });

  it('returns 2.0 for streaks above 30 days', () => {
    expect(streakBonusMultiplier(100)).toBe(2.0);
  });
});
