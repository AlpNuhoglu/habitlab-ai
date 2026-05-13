import { describe, it, expect } from 'vitest';
import { hasEnoughData } from './empty-detection';
import { makeUserAnalytics } from '../testing/fixtures';

describe('hasEnoughData', () => {
  it('returns false for null', () => {
    expect(hasEnoughData(null)).toBe(false);
  });

  it('returns false when totalLogs30d < 5', () => {
    expect(hasEnoughData(makeUserAnalytics({ totalLogs30d: 4 }))).toBe(false);
    expect(hasEnoughData(makeUserAnalytics({ totalLogs30d: 0 }))).toBe(false);
  });

  it('returns true when totalLogs30d >= 5', () => {
    expect(hasEnoughData(makeUserAnalytics({ totalLogs30d: 5 }))).toBe(true);
    expect(hasEnoughData(makeUserAnalytics({ totalLogs30d: 45 }))).toBe(true);
  });
});
