import { Link } from 'react-router-dom';

import { TrackerCell } from './TrackerCell';
import { TrackerHeader } from './TrackerHeader';
import type { TrackerRow } from '../../habits/api/use-tracker-grid';

interface TrackerGridProps {
  readonly rows: TrackerRow[];
  readonly dates: string[]; // YYYY-MM-DD[] ordered
}

export function TrackerGrid({ rows, dates }: TrackerGridProps): React.ReactElement {
  return (
    <div className="overflow-x-auto">
      <TrackerHeader dates={dates} />
      <div className="mt-1 space-y-1">
        {rows.map(({ habit, days }) => {
          const dayMap = new Map(days.map((d) => [d.date, d]));
          return (
            <div key={habit.id} className="flex items-center gap-1">
              <Link
                to={`/habits/${habit.id}`}
                className="w-40 shrink-0 truncate text-right text-xs text-gray-600 hover:text-indigo-600 pr-2"
              >
                {habit.name}
              </Link>
              {dates.map((date) => (
                <TrackerCell
                  key={date}
                  habit={habit}
                  date={date}
                  day={dayMap.get(date)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
