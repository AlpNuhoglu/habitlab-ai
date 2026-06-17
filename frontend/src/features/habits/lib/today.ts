/**
 * Returns the current local date as YYYY-MM-DD in the given IANA timezone.
 * Uses Intl to avoid date-fns-tz dependency.
 */
export function resolveToday(userTz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: userTz }).format(new Date());
}

/**
 * Returns YYYY-MM-DD for a Date in the given timezone.
 */
export function toLocalDate(date: Date, userTz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: userTz }).format(date);
}

/**
 * Returns true when dateIso (YYYY-MM-DD) is strictly after today in the given timezone.
 */
export function isFutureDate(dateIso: string, userTz: string): boolean {
  return dateIso > resolveToday(userTz);
}

/**
 * Maximum days into the past a log may be created. Mirrors the backend
 * RETRO_LIMIT_EXCEEDED rule (habits.service.ts validateLogDate) so the tracker
 * never offers a click that the server is guaranteed to reject.
 */
export const RETRO_LIMIT_DAYS = 7;

/** Returns YYYY-MM-DD shifted `days` earlier than `dateIso`, in UTC date arithmetic. */
function subtractDays(dateIso: string, days: number): string {
  const d = new Date(dateIso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns true when dateIso is older than the backend's retro-logging limit
 * (more than RETRO_LIMIT_DAYS days before today in the given timezone).
 */
export function isBeyondRetroLimit(dateIso: string, userTz: string): boolean {
  return dateIso < subtractDays(resolveToday(userTz), RETRO_LIMIT_DAYS);
}
