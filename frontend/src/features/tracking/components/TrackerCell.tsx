import React from 'react';

import { useCurrentUser } from '../../auth/api/use-current-user';
import { useToggleLog } from '../../habits/api/use-toggle-log';
import { resolveToday } from '../../habits/lib/today';
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
  const isCompleted = day?.status === 'completed';
  const isSkipped = day?.status === 'skipped';

  return (
    <button
      type="button"
      disabled={isFuture}
      title={`${habit.name} — ${date}: ${day?.status ?? 'no log'}`}
      onClick={() =>
        toggle({
          habitId: habit.id,
          date,
          currentStatus: day?.status ?? 'pending',
        })
      }
      className={`h-8 w-8 rounded-md border text-xs font-medium transition-colors ${
        isFuture
          ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-40'
          : isCompleted
          ? 'border-emerald-400 bg-emerald-500 text-white hover:bg-emerald-600'
          : isSkipped
          ? 'border-orange-200 bg-orange-100 text-orange-700 hover:bg-orange-200'
          : 'border-gray-200 bg-white text-gray-300 hover:border-indigo-300 hover:text-indigo-400'
      }`}
    >
      {isCompleted ? '✓' : isSkipped ? '–' : ''}
    </button>
  );
},
areEqual);
