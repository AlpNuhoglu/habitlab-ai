import { useCurrentUser } from '../../auth/api/use-current-user';
import { useToggleLog } from '../api/use-toggle-log';
import { resolveToday } from '../lib/today';
import type { CheckableHabit } from '../types';

interface HabitCheckboxProps {
  readonly habit: CheckableHabit;
  readonly date?: string; // defaults to today in user timezone
  readonly size?: 'sm' | 'md';
}

export function HabitCheckbox({ habit, date, size = 'md' }: HabitCheckboxProps): React.ReactElement {
  const { user } = useCurrentUser();
  const { toggle } = useToggleLog();

  const today = user ? resolveToday(user.timezone) : date ?? '';
  const effectiveDate = date ?? today;
  const isCompleted = habit.todayStatus === 'completed';
  const isFuture = effectiveDate > today;

  const sizeClasses = size === 'sm'
    ? 'h-5 w-5 rounded'
    : 'h-7 w-7 rounded-md';

  return (
    <button
      type="button"
      disabled={isFuture}
      aria-label={isCompleted ? `Unmark ${habit.name}` : `Mark ${habit.name} complete`}
      aria-pressed={isCompleted}
      onClick={() =>
        toggle({
          habitId: habit.id,
          date: effectiveDate,
          currentStatus: habit.todayStatus,
        })
      }
      className={`flex items-center justify-center border-2 transition-all ${sizeClasses} ${
        isCompleted
          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 hover:shadow-[0_0_10px_rgba(34,211,238,0.4)]'
          : 'border-gray-600 bg-transparent hover:border-purple-500 hover:shadow-[0_0_8px_rgba(168,85,247,0.3)]'
      } ${isFuture ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
    >
      {isCompleted && (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}
