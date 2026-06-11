import { memo } from 'react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from '../../../../lib/recharts/primitives';
import { weekdayLabel } from '../../lib/format-axis';
import type { WeekdayBucket } from '../../types';

interface Props {
  readonly data: WeekdayBucket[];
  readonly locale: string;
}

function WeekdayBarChartInner({ data, locale }: Props): React.ReactElement {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-xs text-gray-600">No completions recorded yet.</p>
      </div>
    );
  }

  const chartData = data.map((b) => ({
    name: weekdayLabel(b.weekday, locale),
    count: b.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.1)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
        <Tooltip
          formatter={(value) => [`${typeof value === 'number' ? value : 0} completions`, 'Count']}
          contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px', color: '#e2e8f0' }}
          labelStyle={{ color: '#a78bfa' }}
        />
        <Bar dataKey="count" fill="#a78bfa" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const WeekdayBarChart = memo(WeekdayBarChartInner);
