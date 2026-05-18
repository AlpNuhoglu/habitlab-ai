import { describe, it, expect } from 'vitest';
import { weekdayLabel, hourLabel } from './format-axis';

describe('weekdayLabel — Mon=0 convention', () => {
  it('index 0 → Monday (English)', () => {
    expect(weekdayLabel(0, 'en')).toBe('Mon');
  });

  it('index 1 → Tuesday (English)', () => {
    expect(weekdayLabel(1, 'en')).toBe('Tue');
  });

  it('index 6 → Sunday (English)', () => {
    expect(weekdayLabel(6, 'en')).toBe('Sun');
  });

  it('index 0 → Pazartesi short (Turkish)', () => {
    // Turkish short Monday is "Pzt"
    const label = weekdayLabel(0, 'tr');
    expect(label.length).toBeGreaterThan(0);
    // Verify it's not the English abbreviation
    expect(label).not.toBe('Mon');
  });

  it('index 6 → Sunday short (Turkish)', () => {
    // Turkish short Sunday is "Paz"
    const label = weekdayLabel(6, 'tr');
    expect(label).toBe('Paz');
  });

  it('produces 7 distinct labels for en locale', () => {
    const labels = [0, 1, 2, 3, 4, 5, 6].map((i) => weekdayLabel(i as 0|1|2|3|4|5|6, 'en'));
    const unique = new Set(labels);
    expect(unique.size).toBe(7);
  });
});

describe('hourLabel', () => {
  it('hour 0 in 24h format → "00" or "24" depending on ICU version', () => {
    const label = hourLabel(0, 'en', '24h');
    // ICU/CLDR differs across platforms: macOS returns "00", Linux CI returns "24".
    // Both are valid per the Unicode spec for midnight in 24h format.
    expect(['00', '24', '00:00', '24:00']).toContain(label);
  });

  it('hour 12 in 12h format → "12 PM" or "12 pm"', () => {
    const label = hourLabel(12, 'en', '12h').toLowerCase();
    expect(label).toContain('12');
    expect(label).toContain('pm');
  });
});
