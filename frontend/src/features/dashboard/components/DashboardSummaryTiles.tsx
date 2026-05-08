import type { DashboardSummary } from '../../habits/types';

interface Props {
  readonly summary: DashboardSummary;
}

export function DashboardSummaryTiles({ summary }: Props): React.ReactElement {
  const { activeHabits, todayCompleted, longestStreakAnyHabit, overallCompletionRate30d } =
    summary.summary;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiTile label="Active habits" value={String(activeHabits)} />
      <KpiTile label="Completed today" value={String(todayCompleted)} />
      <KpiTile label="Best streak" value={`${longestStreakAnyHabit}d`} />
      <KpiTile label="30d avg" value={`${Math.round(overallCompletionRate30d * 100)}%`} />
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
