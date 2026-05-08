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
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={effectiveTo}
              max={today}
              min={effectiveFrom}
              onChange={(e) => setTrackerRange(effectiveFrom, e.target.value)}
              className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600"
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="animate-pulse space-y-1 pt-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No active habits to track. <a href="/habits" className="text-indigo-500 underline">Create one</a>.
        </div>
      ) : (
        <div className="pt-4">
          <TrackerGrid rows={rows} dates={dates} />
        </div>
      )}
    </div>
  );
}
