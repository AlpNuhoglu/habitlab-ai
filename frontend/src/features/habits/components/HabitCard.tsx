import { Link } from 'react-router-dom';

import { useCurrentUser } from '../../auth/api/use-current-user';
import { isDueToday } from '../../../lib/due-today';
import { resolveToday } from '../lib/today';
import { formatStreak, formatRate } from '../lib/streak';
import { HabitCheckbox } from './HabitCheckbox';
import type { Habit } from '../types';

type Variant = 'default' | 'compact' | 'row';

interface HabitCardProps {
  readonly habit: Habit;
  readonly variant?: Variant | undefined;
  readonly onEdit?: ((habit: Habit) => void) | undefined;
  readonly onDelete?: ((habit: Habit) => void) | undefined;
}

export function HabitCard({
  habit,
  variant = 'default',
  onEdit,
  onDelete,
}: HabitCardProps): React.ReactElement {
  const { user } = useCurrentUser();
  const today = user ? resolveToday(user.timezone) : '';
  const due = user ? isDueToday(habit, today) : true;

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
        <HabitCheckbox habit={habit} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900">{habit.name}</p>
          <p className="text-xs text-gray-400">{formatStreak(habit.currentStreak)}</p>
        </div>
        {due && (
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
            Due
          </span>
        )}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="flex items-center gap-4 border-b border-gray-100 py-3">
        <HabitCheckbox habit={habit} />
        <Link
          to={`/habits/${habit.id}`}
          className="min-w-0 flex-1 hover:underline"
        >
          <p className="truncate text-sm font-medium text-gray-900">{habit.name}</p>
        </Link>
        <span className="hidden text-xs text-gray-400 sm:block">{formatRate(habit.completionRate30d)}</span>
        <span className="text-xs text-gray-400">{formatStreak(habit.currentStreak)}</span>
        <div className="flex gap-1">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(habit)}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
              aria-label="Edit"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(habit)}
              className="rounded p-1 text-gray-400 hover:text-red-500"
              aria-label="Archive"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  // default card
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <Link
          to={`/habits/${habit.id}`}
          className="min-w-0 flex-1 font-medium text-gray-900 hover:text-indigo-600 hover:underline"
        >
          <span className="line-clamp-2">{habit.name}</span>
        </Link>
        <div className="ml-2 flex gap-1 shrink-0">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(habit)}
              className="rounded p-1 text-gray-300 hover:text-gray-500"
              aria-label="Edit"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-gray-700">{formatStreak(habit.currentStreak)}</span>
          <span className="text-xs text-gray-400">{formatRate(habit.completionRate30d)} last 30d</span>
        </div>
        <HabitCheckbox habit={habit} />
      </div>

      {due && habit.todayStatus !== 'completed' && (
        <div className="mt-auto">
          <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
            Due today
          </span>
        </div>
      )}
    </div>
  );
}
