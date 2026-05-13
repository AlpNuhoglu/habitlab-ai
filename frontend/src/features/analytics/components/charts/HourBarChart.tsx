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
import { hourLabel } from '../../lib/format-axis';
import type { HourBucket } from '../../types';

interface Props {
  readonly data: HourBucket[];
  readonly locale: string;
  readonly format: '12h' | '24h';
}

function HourBarChartInner({ data, locale, format }: Props): React.ReactElement {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-xs text-gray-400">No completions recorded yet.</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map((b) => b.count), 1);
  // Clip y-axis to max * 1.2 so sparse data is readable (§7.1 #13)
  const yMax = Math.ceil(maxCount * 1.2);

  const chartData = data.map((b) => ({
    name: hourLabel(b.hour, locale, format),
    count: b.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={3} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} domain={[0, yMax]} />
        <Tooltip
          formatter={(value) => [`${typeof value === 'number' ? value : 0} completions`, 'Count']}
        />
        <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const HourBarChart = memo(HourBarChartInner);
