// Anchor date that falls on Monday — used to derive weekday labels for Mon=0 convention.
// 2026-01-05 was a Monday. Using a fixed UTC noon avoids DST and timezone shifts.
const MONDAY_ANCHOR = new Date('2026-01-05T12:00:00Z');

/**
 * Returns the locale-aware short weekday name for the given index.
 * Convention: 0=Monday ... 6=Sunday (backend Mon=0 convention).
 * NEVER use Date.getDay() — it uses Sun=0.
 */
export function weekdayLabel(index: 0 | 1 | 2 | 3 | 4 | 5 | 6, locale: string): string {
  const d = new Date(MONDAY_ANCHOR);
  d.setUTCDate(MONDAY_ANCHOR.getUTCDate() + index);
  return new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
}

/**
 * Returns the locale-aware hour label for the given hour (0..23).
 * The hour value is user-local (backend already bucketed by user timezone).
 */
export function hourLabel(hour: number, locale: string, format: '12h' | '24h'): string {
  const d = new Date('2026-01-05T00:00:00Z');
  d.setUTCHours(hour);
  // timeZone: 'UTC' ensures consistent output regardless of test/runtime TZ
  const opts: Intl.DateTimeFormatOptions =
    format === '12h'
      ? { hour: 'numeric', hour12: true, timeZone: 'UTC' }
      : { hour: '2-digit', hour12: false, timeZone: 'UTC' };
  return new Intl.DateTimeFormat(locale, opts).format(d);
}
