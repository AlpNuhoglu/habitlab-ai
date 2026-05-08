import { describe, it, expect } from 'vitest';
import { isDueToday } from './due-today';

// 2026-05-07 is a Thursday (UTC day = 4, bitIndex = (4+6)%7 = 3 = bit 3 = Thu)
const THURSDAY = '2026-05-07';
// 2026-05-11 is a Monday (UTC day = 1, bitIndex = 0)
const MONDAY = '2026-05-11';
// 2026-05-09 is a Saturday (UTC day = 6, bitIndex = (6+6)%7 = 5)
const SATURDAY = '2026-05-09';

describe('isDueToday', () => {
  describe('daily', () => {
    it('always returns true', () => {
      const habit = { frequencyType: 'daily' as const, weekdayMask: null, targetCountPerWeek: null };
      expect(isDueToday(habit, THURSDAY)).toBe(true);
      expect(isDueToday(habit, MONDAY)).toBe(true);
      expect(isDueToday(habit, SATURDAY)).toBe(true);
    });
  });

  describe('weekly', () => {
    it('returns true when bit matches weekday', () => {
      // bit 3 = Thursday (bitIndex 3)
      const thursdayHabit = { frequencyType: 'weekly' as const, weekdayMask: 0b0001000, targetCountPerWeek: null };
      expect(isDueToday(thursdayHabit, THURSDAY)).toBe(true);
    });

    it('returns false when bit does not match', () => {
      const thursdayHabit = { frequencyType: 'weekly' as const, weekdayMask: 0b0001000, targetCountPerWeek: null };
      expect(isDueToday(thursdayHabit, MONDAY)).toBe(false);
      expect(isDueToday(thursdayHabit, SATURDAY)).toBe(false);
    });

    it('returns false when weekdayMask is null', () => {
      const habit = { frequencyType: 'weekly' as const, weekdayMask: null, targetCountPerWeek: null };
      expect(isDueToday(habit, THURSDAY)).toBe(false);
    });

    it('handles Monday correctly (bit 0)', () => {
      // bit 0 = Monday
      const mondayHabit = { frequencyType: 'weekly' as const, weekdayMask: 0b0000001, targetCountPerWeek: null };
      expect(isDueToday(mondayHabit, MONDAY)).toBe(true);
      expect(isDueToday(mondayHabit, THURSDAY)).toBe(false);
    });

    it('handles Saturday correctly (bit 5)', () => {
      // bit 5 = Saturday
      const satHabit = { frequencyType: 'weekly' as const, weekdayMask: 0b0100000, targetCountPerWeek: null };
      expect(isDueToday(satHabit, SATURDAY)).toBe(true);
      expect(isDueToday(satHabit, MONDAY)).toBe(false);
    });

    it('handles multi-day mask', () => {
      // Mon + Thu = bit 0 + bit 3 = 0b0001001 = 9
      const monThuHabit = { frequencyType: 'weekly' as const, weekdayMask: 9, targetCountPerWeek: null };
      expect(isDueToday(monThuHabit, MONDAY)).toBe(true);
      expect(isDueToday(monThuHabit, THURSDAY)).toBe(true);
      expect(isDueToday(monThuHabit, SATURDAY)).toBe(false);
    });
  });

  describe('custom', () => {
    const habit = { frequencyType: 'custom' as const, weekdayMask: null, targetCountPerWeek: 3 };

    it('returns true when fewer completions than target', () => {
      // Week of 2026-05-04 (Mon) to 2026-05-10 (Sun); Thursday is in this week
      const logsThisWeek = [
        { date: '2026-05-04', status: 'completed' as const },
        { date: '2026-05-05', status: 'completed' as const },
      ];
      expect(isDueToday(habit, THURSDAY, logsThisWeek)).toBe(true);
    });

    it('returns false when target reached', () => {
      const logsThisWeek = [
        { date: '2026-05-04', status: 'completed' as const },
        { date: '2026-05-05', status: 'completed' as const },
        { date: '2026-05-06', status: 'completed' as const },
      ];
      expect(isDueToday(habit, THURSDAY, logsThisWeek)).toBe(false);
    });

    it('does not count skipped logs toward target', () => {
      const logsThisWeek = [
        { date: '2026-05-04', status: 'completed' as const },
        { date: '2026-05-05', status: 'skipped' as const },
        { date: '2026-05-06', status: 'skipped' as const },
      ];
      // only 1 completed, target 3 → still due
      expect(isDueToday(habit, THURSDAY, logsThisWeek)).toBe(true);
    });

    it('returns false when targetCountPerWeek is null', () => {
      const h = { frequencyType: 'custom' as const, weekdayMask: null, targetCountPerWeek: null };
      expect(isDueToday(h, THURSDAY)).toBe(false);
    });

    it('logs from a different week are ignored', () => {
      // Previous week Mon
      const logsFromLastWeek = [
        { date: '2026-04-27', status: 'completed' as const },
        { date: '2026-04-28', status: 'completed' as const },
        { date: '2026-04-29', status: 'completed' as const },
      ];
      // This week has 0 completions → still due
      expect(isDueToday(habit, THURSDAY, logsFromLastWeek)).toBe(true);
    });
  });
});
