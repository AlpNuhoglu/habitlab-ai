import { useMemo } from 'react';
import { eachDayOfInterval, parseISO, format, subDays } from 'date-fns';

import { PageHeader } from '../../../components/PageHeader';
import { useCurrentUser } from '../../auth/api/use-current-user';
import { useTrackerGrid } from '../../habits/api/use-tracker-grid';
import { resolveToday } from '../../habits/lib/today';
import { useHabitsUIStore } from '../../habits/store/habits-ui-store';
import { TrackerGrid } from '../components/TrackerGrid';

const DEFAULT_DAYS = 14;

export function TrackerPage(): React.ReactElement {
  const { user } = useCurrentUser();
  const { trackerFrom, trackerTo, setTrackerRange } = useHabitsUIStore();

  const today = user ? resolveToday(user.timezone) : format(new Date(), 'yyyy-MM-dd');
  const effectiveTo = trackerTo ?? today;
  const effectiveFrom = trackerFrom ?? format(subDays(parseISO(effectiveTo), DEFAULT_DAYS - 1), 'yyyy-MM-dd');

  const dates = useMemo(
    () =>
      eachDayOfInterval({ start: parseISO(effectiveFrom), end: parseISO(effectiveTo) }).map((d) =>
        format(d, 'yyyy-MM-dd'),
      ),
    [effectiveFrom, effectiveTo],
  );

  const { rows, isLoading } = useTrackerGrid(effectiveFrom, effectiveTo);

  return (
    <div>
      <PageHeader
        title="Tracker"
        subtitle="Log habits across multiple days."
        actions={
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={effectiveFrom}
              max={effectiveTo}
              onChange={(e) => setTrackerRange(e.target.value, effectiveTo)}
              className="rounded border border-gray-700 bg-gray-900/60 px-2 py-1 text-xs text-gray-300 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
            <span className="text-xs text-gray-600">to</span>
            <input
              type="date"
              value={effectiveTo}
              max={today}
              min={effectiveFrom}
              onChange={(e) => setTrackerRange(effectiveFrom, e.target.value)}
              className="rounded border border-gray-700 bg-gray-900/60 px-2 py-1 text-xs text-gray-300 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="animate-pulse space-y-1 pt-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-gray-800/60" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-purple-500/20 py-16 text-center text-sm text-gray-500">
          No active habits to track. <a href="/habits" className="text-cyan-400 hover:text-cyan-300 underline">Create one</a>.
        </div>
      ) : (
        <div className="pt-4">
          <TrackerGrid rows={rows} dates={dates} />
        </div>
      )}
    </div>
  );
}
