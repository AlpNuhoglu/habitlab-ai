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
        <p className="text-xs text-gray-600">Log more days to see a trend.</p>
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
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,85,247,0.1)" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <Tooltip
          formatter={(value) => [`${typeof value === 'number' ? value : 0}%`, 'Completion rate']}
          contentStyle={{ backgroundColor: '#0f0f0f', border: '1px solid rgba(168,85,247,0.3)', borderRadius: '8px', color: '#e2e8f0' }}
          labelStyle={{ color: '#a78bfa' }}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#22d3ee"
          strokeWidth={2}
          dot={isDot ? { r: 5, fill: '#22d3ee' } : { r: 3, fill: '#22d3ee' }}
          activeDot={{ r: 6, fill: '#a78bfa' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const CompletionTrendLine = memo(CompletionTrendLineInner);
