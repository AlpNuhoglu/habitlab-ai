import { memo } from 'react';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from '../../../../lib/recharts/primitives';
import type { CompletionTrendPoint } from '../../types';

interface Props {
  readonly data: CompletionTrendPoint[];
}

function CompletionTrendLineInner({ data }: Props): React.ReactElement {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-xs text-gray-400">Log more days to see a trend.</p>
      </div>
    );
  }

  const chartData = data.map((p) => ({
    month: p.month,
    rate: Math.round(p.rate * 100),
  }));

  // Single data point — render a dot with explanatory title
  const isDot = data.length === 1;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => [`${typeof value === 'number' ? value : 0}%`, 'Completion rate']}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#10b981"
          strokeWidth={2}
          dot={isDot ? { r: 5 } : { r: 3 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const CompletionTrendLine = memo(CompletionTrendLineInner);
