import { useMemo } from 'react';
import { parseISO, eachDayOfInterval, format, startOfWeek } from 'date-fns';

import { useHabitCalendar } from '../api/use-habit-calendar';
import type { CalendarDay } from '../types';

interface HabitCalendarHeatmapProps {
  readonly habitId: string;
  readonly habitCreatedAt: string;
  readonly from: string;
  readonly to: string;
}

function cellColor(day: CalendarDay | undefined, isBefore: boolean): string {
  if (isBefore) return 'bg-gray-50';
  if (!day || day.status === null) return 'bg-gray-200';
  if (day.status === 'completed') return 'bg-emerald-500';
  return 'bg-red-200'; // skipped
}

export function HabitCalendarHeatmap({
  habitId,
  habitCreatedAt,
  from,
  to,
}: HabitCalendarHeatmapProps): React.ReactElement {
  const { data = [], isPending } = useHabitCalendar(habitId, from, to);

  const dayMap = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const d of data) m.set(d.date, d);
    return m;
  }, [data]);

  const weeks = useMemo(() => {
    const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });
    const firstMonday = startOfWeek(parseISO(from), { weekStartsOn: 1 });
    const allDays = eachDayOfInterval({ start: firstMonday, end: parseISO(to) });

    const grouped: (string | null)[][] = [];
    let week: (string | null)[] = [];
    for (const d of allDays) {
      const iso = format(d, 'yyyy-MM-dd');
      const inRange = days.some((rd) => format(rd, 'yyyy-MM-dd') === iso);
      week.push(inRange ? iso : null);
      if (week.length === 7) {
        grouped.push(week);
        week = [];
      }
    }
    if (week.length) grouped.push(week);
    return grouped;
  }, [from, to]);

  if (isPending) {
    return <div className="h-24 animate-pulse rounded-lg bg-gray-100" />;
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5 min-w-max">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-0.5">
            {week.map((dateIso, di) => {
              if (!dateIso) return <div key={di} className="h-3 w-3" />;
              const isBefore = dateIso < habitCreatedAt.slice(0, 10);
              const day = dayMap.get(dateIso);
              return (
                <div
                  key={dateIso}
                  title={`${dateIso}: ${day?.status ?? (isBefore ? 'before creation' : 'no data')}`}
                  className={`h-3 w-3 rounded-sm ${cellColor(day, isBefore)}`}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Completed</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-red-200" /> Skipped</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-gray-200" /> No data</span>
      </div>
    </div>
  );
}
