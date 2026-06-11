import type { KpiTileModel } from '../../types';

type Props = KpiTileModel;

export function KpiTile({ label, value, delta, hint }: Props): React.ReactElement {
  return (
    <div
      className="rounded-xl border border-cyan-500/20 bg-gray-900/40 backdrop-blur-md p-4 hover:border-cyan-400/40 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all"
      title={hint}
    >
      <p className="text-xs tracking-widest uppercase text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-cyan-400 font-mono">{value}</p>
      {delta !== undefined && (
        <p
          className={`mt-1 text-xs font-medium font-mono ${
            delta.polarity === 'positive' ? 'text-emerald-400' : 'text-red-400'
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
