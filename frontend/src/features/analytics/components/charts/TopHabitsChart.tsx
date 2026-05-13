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
  slate: '#64748b',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
};

const FALLBACK_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#f43f5e'];

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
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => [`${typeof value === 'number' ? value : 0}%`, '30-day rate']} />
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
