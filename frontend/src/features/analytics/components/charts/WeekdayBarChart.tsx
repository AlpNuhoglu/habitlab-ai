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
        <p className="text-xs text-gray-400">No completions recorded yet.</p>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${typeof value === 'number' ? value : 0} completions`, 'Count']}
        />
        <Bar dataKey="count" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const WeekdayBarChart = memo(WeekdayBarChartInner);
