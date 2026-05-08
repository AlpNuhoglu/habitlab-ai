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
