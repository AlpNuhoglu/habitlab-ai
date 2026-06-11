import type { DashboardSummary } from '../../habits/types';

interface Props {
  readonly summary: DashboardSummary;
}

export function DashboardSummaryTiles({ summary }: Props): React.ReactElement {
  const { activeHabits, todayCompleted, longestStreakAnyHabit, overallCompletionRate30d } =
    summary.summary;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiTile label="Active habits" value={String(activeHabits)} color="purple" />
      <KpiTile label="Completed today" value={String(todayCompleted)} color="cyan" />
      <KpiTile label="Best streak" value={`${longestStreakAnyHabit}d`} color="fuchsia" />
      <KpiTile label="30d avg" value={`${Math.round(overallCompletionRate30d * 100)}%`} color="blue" />
    </div>
  );
}

function KpiTile({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: string; 
  color: 'purple' | 'cyan' | 'fuchsia' | 'blue';
}): React.ReactElement {
  const colorClasses = {
    purple: 'border-purple-500/30 hover:border-purple-400/50 hover:glow-purple',
    cyan: 'border-cyan-500/30 hover:border-cyan-400/50 hover:glow-cyan',
    fuchsia: 'border-fuchsia-500/30 hover:border-fuchsia-400/50 hover:glow-fuchsia',
    blue: 'border-blue-500/30 hover:border-blue-400/50',
  };

  const textColorClasses = {
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
    fuchsia: 'text-fuchsia-400',
    blue: 'text-blue-400',
  };

  const glowClasses = {
    purple: 'from-purple-500/5 to-transparent',
    cyan: 'from-cyan-500/5 to-transparent',
    fuchsia: 'from-fuchsia-500/5 to-transparent',
    blue: 'from-blue-500/5 to-transparent',
  };

  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl border bg-gray-900/40 backdrop-blur-md p-4 
        transition-all duration-200 ${colorClasses[color]}
      `}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${glowClasses[color]} opacity-50`} />
      <div className="relative z-10">
        <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${textColorClasses[color]}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
