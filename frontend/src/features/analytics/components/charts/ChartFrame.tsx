import type { ChartFrameProps } from '../../types';

export function ChartFrame({
  title,
  description,
  isPending,
  isError,
  accessibleData,
  children,
}: ChartFrameProps): React.ReactElement {
  return (
    <div className="print:break-inside-avoid rounded-xl border border-purple-500/20 bg-gray-900/40 backdrop-blur-md p-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold tracking-widest uppercase text-gray-400">{title}</h3>
        {description !== undefined && (
          <p className="mt-0.5 text-xs text-gray-600">{description}</p>
        )}
      </div>

      {isPending && (
        <div className="h-40 animate-pulse rounded-lg bg-gray-800/60" />
      )}

      {!isPending && isError && (
        <div className="flex h-40 items-center justify-center">
          <p className="text-xs text-gray-600">Could not load chart data.</p>
        </div>
      )}

      {!isPending && !isError && children}

      {/* Screen-reader-only accessible data table — always rendered so assistive tech can find it */}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {accessibleData.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
