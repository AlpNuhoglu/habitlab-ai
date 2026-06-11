import { memo } from 'react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from '../../../../lib/recharts/primitives';
import type { TopHabitRow } from '../../types';

const COLOR_MAP: Record<string, string> = {
  slate: '#22d3ee',
  blue: '#38bdf8',
  emerald: '#34d399',
  amber: '#a78bfa',
  rose: '#e879f9',
  violet: '#818cf8',
};

const FALLBACK_COLORS = ['#22d3ee', '#a78bfa', '#e879f9', '#38bdf8', '#34d399'];

interface Props {
  readonly data: TopHabitRow[];
}

function TopHabitsChartInner({ data }: Props): React.ReactElement {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-xs text-gray-400">No habits tracked yet.</p>
      </div>
    );
  }

  const chartData = data.map((h, i) => ({
    name: h.name.length > 16 ? h.name.slice(0, 14) + '…' : h.name,
    rate: Math.round(h.rate30d * 100),
    color: h.color !== undefined ? (COLOR_MAP[h.color] ?? '#64748b') : (FALLBACK_COLORS[i % FALLBACK_COLORS.length] ?? '#64748b'),
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 24, left: 4, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.1)" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <Tooltip
          formatter={(value) => [`${typeof value === 'number' ? value : 0}%`, '30-day rate']}
          contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px', color: '#e2e8f0' }}
          labelStyle={{ color: '#a78bfa' }}
        />
        <Bar dataKey="rate" radius={[0, 3, 3, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export const TopHabitsChart = memo(TopHabitsChartInner);
