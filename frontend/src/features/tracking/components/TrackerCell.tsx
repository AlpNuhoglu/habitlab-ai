import React from 'react';

import { useCurrentUser } from '../../auth/api/use-current-user';
import { useToggleLog } from '../../habits/api/use-toggle-log';
import { isBeyondRetroLimit, resolveToday } from '../../habits/lib/today';
import type { Habit, CalendarDay } from '../../habits/types';

interface TrackerCellProps {
  readonly habit: Habit;
  readonly date: string; // YYYY-MM-DD
  readonly day: CalendarDay | undefined;
}

function areEqual(prev: TrackerCellProps, next: TrackerCellProps): boolean {
  return (
    prev.habit.id === next.habit.id &&
    prev.date === next.date &&
    prev.day?.status === next.day?.status
  );
}

export const TrackerCell = React.memo(function TrackerCell({
  habit,
  date,
  day,
}: TrackerCellProps): React.ReactElement {
  const { user } = useCurrentUser();
  const { toggle } = useToggleLog();
  const today = user ? resolveToday(user.timezone) : '';
  const isFuture = date > today;
  // The backend rejects logs older than 7 days (RETRO_LIMIT_EXCEEDED). Block the
  // click here so the cell never flashes a ✓ that the server silently rolls back.
  const isLocked = user ? isBeyondRetroLimit(date, user.timezone) : false;
  const isDisabled = isFuture || isLocked;
  const isCompleted = day?.status === 'completed';
  const isSkipped = day?.status === 'skipped';

  const title = isFuture
    ? `${habit.name} — ${date}: future date`
    : isLocked
    ? `${habit.name} — ${date}: too old to log (7-day limit)`
    : `${habit.name} — ${date}: ${day?.status ?? 'no log'}`;

  return (
    <button
      type="button"
      disabled={isDisabled}
      title={title}
      onClick={() =>
        toggle({
          habitId: habit.id,
          date,
          currentStatus: day?.status ?? 'pending',
        })
      }
      className={`h-8 w-8 rounded-md border text-xs font-medium transition-all ${
        isDisabled
          ? 'cursor-not-allowed border-gray-800 bg-gray-900/20 opacity-30'
          : isCompleted
          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-[0_0_8px_rgba(34,211,238,0.3)]'
          : isSkipped
          ? 'border-orange-500/40 bg-orange-900/20 text-orange-400 hover:bg-orange-900/30'
          : 'border-gray-700 bg-transparent text-gray-700 hover:border-purple-500/50 hover:text-purple-400'
      }`}
    >
      {isCompleted ? '✓' : isSkipped ? '–' : ''}
    </button>
  );
},
areEqual);
