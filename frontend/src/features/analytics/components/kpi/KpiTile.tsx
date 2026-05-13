import type { KpiTileModel } from '../../types';

type Props = KpiTileModel;

export function KpiTile({ label, value, delta, hint }: Props): React.ReactElement {
  return (
    <div
      className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
      title={hint}
    >
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {delta !== undefined && (
        <p
          className={`mt-1 text-xs font-medium ${
            delta.polarity === 'positive' ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          {delta.direction === 'up' ? '↑' : delta.direction === 'down' ? '↓' : '→'}{' '}
          {delta.value > 0 ? '+' : ''}
          {delta.value}
        </p>
      )}
    </div>
  );
}
