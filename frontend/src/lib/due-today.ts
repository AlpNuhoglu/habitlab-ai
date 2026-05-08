export interface DueTodayHabit {
  readonly frequencyType: 'daily' | 'weekly' | 'custom';
  readonly weekdayMask: number | null;
  readonly targetCountPerWeek: number | null;
}

export interface DueTodayLog {
  readonly date: string; // YYYY-MM-DD
  readonly status: 'completed' | 'skipped' | null;
}

/**
 * Returns true when the habit should appear in "today's" list.
 *
 * dateIso is already the correct local date in the user's timezone (from resolveToday()).
 * Parsing it as UTC gives the right weekday because the string encodes the local date.
 *
 * Backend weekdayMask: bit 0 = Monday, bit 6 = Sunday.
 * JS getUTCDay():      0 = Sunday, 1 = Monday … 6 = Saturday.
 * Conversion:          bitIndex = (utcDay + 6) % 7
 */
export function isDueToday(
  habit: DueTodayHabit,
  dateIso: string,
  logsThisWeek: DueTodayLog[] = [],
): boolean {
  switch (habit.frequencyType) {
    case 'daily':
      return true;

    case 'weekly': {
      if (habit.weekdayMask == null) return false;
      const [y, m, d] = parseDateParts(dateIso);
      const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun…6=Sat
      const bitIndex = (utcDay + 6) % 7; // 0=Mon…6=Sun
      return ((habit.weekdayMask >> bitIndex) & 1) === 1;
    }

    case 'custom': {
      if (habit.targetCountPerWeek == null) return false;
      const weekStart = getMonWeekStart(dateIso);
      const weekEnd = addDays(weekStart, 6);
      const completedThisWeek = logsThisWeek.filter(
        (l) => l.status === 'completed' && l.date >= weekStart && l.date <= weekEnd,
      ).length;
      return completedThisWeek < habit.targetCountPerWeek;
    }
  }
}

function parseDateParts(dateIso: string): [number, number, number] {
  const parts = dateIso.split('-');
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

/** Returns YYYY-MM-DD of the Monday that starts the ISO week containing dateIso. */
function getMonWeekStart(dateIso: string): string {
  const [y, m, d] = parseDateParts(dateIso);
  const date = new Date(Date.UTC(y, m - 1, d));
  const utcDay = date.getUTCDay(); // 0=Sun
  const diffToMon = (utcDay + 6) % 7; // 0 when already Mon
  date.setUTCDate(date.getUTCDate() - diffToMon);
  return date.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string {
  const [y, m, d] = parseDateParts(dateIso);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
