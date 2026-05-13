import { describe, it, expect } from 'vitest';
import { getRateField, getHabitRateField } from './range-presets';

describe('getRateField', () => {
  it('30d → completionRateOverall', () => {
    expect(getRateField('30d')).toBe('completionRateOverall');
  });

  it('7d → completionRate7d', () => {
    expect(getRateField('7d')).toBe('completionRate7d');
  });

  it('all → completionRateAllTime', () => {
    expect(getRateField('all')).toBe('completionRateAllTime');
  });

  it('90d falls back to completionRateOverall (no 90d in GlobalAnalyticsDto)', () => {
    expect(getRateField('90d')).toBe('completionRateOverall');
  });
});

describe('getHabitRateField', () => {
  it('30d → completionRate30d', () => {
    expect(getHabitRateField('30d')).toBe('completionRate30d');
  });

  it('90d → completionRate90d', () => {
    expect(getHabitRateField('90d')).toBe('completionRate90d');
  });

  it('all → completionRateAllTime', () => {
    expect(getHabitRateField('all')).toBe('completionRateAllTime');
  });
});
