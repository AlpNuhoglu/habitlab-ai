import { useCurrentUser } from '../../auth/api/use-current-user';
import { useToggleLog } from '../../habits/api/use-toggle-log';
import { resolveToday } from '../../habits/lib/today';
import { formatStreak } from '../../habits/lib/streak';
import type { DashboardSummary, DashboardHabit } from '../../habits/types';

interface Props {
  readonly summary: DashboardSummary;
}

export function TodayList({ summary }: Props): React.ReactElement {
  if (summary.habits.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-purple-500/20 py-10 text-center text-sm text-gray-500">
        No active habits yet. Create one to get started!
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {summary.habits.map((h) => (
        <TodayHabitRow key={h.id} habit={h} />
      ))}
    </div>
  );
}

function TodayHabitRow({ habit }: { habit: DashboardHabit }): React.ReactElement {
  const { user } = useCurrentUser();
  const { toggle } = useToggleLog();
  const today = user ? resolveToday(user.timezone) : new Intl.DateTimeFormat('en-CA').format(new Date());
  const isCompleted = habit.todayStatus === 'completed';

  return (
    <div className="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-gray-900/40 backdrop-blur-md px-3 py-2.5 hover:border-purple-400/40 hover:shadow-[0_0_12px_rgba(168,85,247,0.15)] transition-all">
      <button
        type="button"
        aria-label={isCompleted ? `Unmark ${habit.name}` : `Mark ${habit.name} complete`}
        aria-pressed={isCompleted}
        onClick={() =>
          toggle({ habitId: habit.id, date: today, currentStatus: habit.todayStatus })
        }
        className={`h-5 w-5 shrink-0 rounded border-2 transition-all flex items-center justify-center ${
          isCompleted
            ? 'border-cyan-500 bg-cyan-500 text-black hover:shadow-[0_0_10px_rgba(34,211,238,0.5)]'
            : 'border-gray-600 bg-transparent hover:border-purple-400 hover:shadow-[0_0_8px_rgba(168,85,247,0.3)]'
        }`}
      >
        {isCompleted && (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-100">{habit.name}</p>
        <p className="text-xs text-gray-500">{formatStreak(habit.currentStreak)}</p>
      </div>
      {habit.todayStatus === 'pending' && (
        <span className="shrink-0 rounded-full border border-purple-500/40 bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-400">
          Due
        </span>
      )}
      {habit.todayStatus === 'completed' && (
        <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-900/20 px-2 py-0.5 text-xs font-medium text-cyan-400">
          Done
        </span>
      )}
    </div>
  );
}
