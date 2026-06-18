import {
  computeFrequencyStreak,
  computeFrequencyLongestStreak,
  type StreakFrequency,
} from './habits.service';

// Reference Mondays used across the cases (all real Mondays):
//   2026-06-01, 2026-06-08, 2026-06-15 (current week in these tests)
const TODAY = '2026-06-17'; // a Wednesday in the 2026-06-15 week

const daily: StreakFrequency = { frequencyType: 'daily', weekdayMask: null, targetCountPerWeek: null };
// weekly: Mon | Wed | Fri  → bits 0,2,4 → mask 0b0010101 = 21
const weeklyMWF: StreakFrequency = { frequencyType: 'weekly', weekdayMask: 21, targetCountPerWeek: null };
// custom: any 3 completions per week
const custom3: StreakFrequency = { frequencyType: 'custom', weekdayMask: null, targetCountPerWeek: 3 };

describe('computeFrequencyStreak — daily delegates to day-level', () => {
  it('counts consecutive completed days ending today', () => {
    const dates = ['2026-06-15', '2026-06-16', '2026-06-17'];
    expect(computeFrequencyStreak(dates, TODAY, daily)).toBe(3);
  });

  it('treats today as in-progress (no log today does not break)', () => {
    const dates = ['2026-06-15', '2026-06-16'];
    expect(computeFrequencyStreak(dates, TODAY, daily)).toBe(2);
  });
});

describe('computeFrequencyStreak — weekly (all masked weekdays must be completed)', () => {
  it('counts consecutive satisfied weeks; current week in-progress never breaks', () => {
    // Two fully satisfied past weeks (Mon/Wed/Fri each), current week not yet complete.
    const dates = [
      // week of 06-01: Mon 01, Wed 03, Fri 05
      '2026-06-01', '2026-06-03', '2026-06-05',
      // week of 06-08: Mon 08, Wed 10, Fri 12
      '2026-06-08', '2026-06-10', '2026-06-12',
      // current week of 06-15: only Mon 15 so far → in-progress, must not break
      '2026-06-15',
    ];
    expect(computeFrequencyStreak(dates, TODAY, weeklyMWF)).toBe(2);
  });

  it('counts the current week when it is already satisfied', () => {
    const dates = [
      '2026-06-08', '2026-06-10', '2026-06-12', // past week satisfied
      '2026-06-15', '2026-06-17', '2026-06-19', // current week Mon/Wed/Fri all done
    ];
    expect(computeFrequencyStreak(dates, TODAY, weeklyMWF)).toBe(2);
  });

  it('a partially-completed past week breaks the streak', () => {
    const dates = [
      '2026-06-01', '2026-06-03', '2026-06-05', // satisfied
      '2026-06-08', '2026-06-10', // week of 06-08 MISSING Friday → not satisfied
      '2026-06-15', '2026-06-17', '2026-06-19', // current satisfied
    ];
    // Walking back from current: current satisfied (1), prev week (06-08) not → stop.
    expect(computeFrequencyStreak(dates, TODAY, weeklyMWF)).toBe(1);
  });

  it('returns 0 when no week is satisfied', () => {
    const dates = ['2026-06-08', '2026-06-15']; // only Mondays
    expect(computeFrequencyStreak(dates, TODAY, weeklyMWF)).toBe(0);
  });
});

describe('computeFrequencyStreak — custom (target completions per week)', () => {
  it('counts weeks reaching the target regardless of which days', () => {
    const dates = [
      '2026-06-01', '2026-06-02', '2026-06-04', // week 06-01: 3 ≥ target
      '2026-06-09', '2026-06-11', '2026-06-13', // week 06-08: 3 ≥ target
      '2026-06-16', '2026-06-17',               // current week: only 2 so far (in-progress)
    ];
    expect(computeFrequencyStreak(dates, TODAY, custom3)).toBe(2);
  });

  it('a past week below target breaks the streak', () => {
    const dates = [
      '2026-06-01', '2026-06-02', '2026-06-04', // satisfied
      '2026-06-09', '2026-06-11',               // only 2 < target → breaks
      '2026-06-15', '2026-06-16', '2026-06-17', // current satisfied
    ];
    expect(computeFrequencyStreak(dates, TODAY, custom3)).toBe(1);
  });
});

describe('computeFrequencyLongestStreak', () => {
  it('daily delegates to day-level longest', () => {
    const dates = ['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-10'];
    expect(computeFrequencyLongestStreak(dates, daily)).toBe(3);
  });

  it('weekly finds the longest run of consecutive satisfied weeks anywhere in history', () => {
    const dates = [
      // run A: weeks 06-01, 06-08 satisfied (2)
      '2026-06-01', '2026-06-03', '2026-06-05',
      '2026-06-08', '2026-06-10', '2026-06-12',
      // gap: week 06-15 missing Friday → not satisfied
      '2026-06-15', '2026-06-17',
      // run B: weeks 06-22, 06-29, 07-06 satisfied (3)
      '2026-06-22', '2026-06-24', '2026-06-26',
      '2026-06-29', '2026-07-01', '2026-07-03',
      '2026-07-06', '2026-07-08', '2026-07-10',
    ];
    expect(computeFrequencyLongestStreak(dates, weeklyMWF)).toBe(3);
  });

  it('returns 0 when no week is ever satisfied', () => {
    expect(computeFrequencyLongestStreak(['2026-06-15'], weeklyMWF)).toBe(0);
  });
});
