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
    <div className="print:break-inside-avoid rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {description !== undefined && (
          <p className="mt-0.5 text-xs text-gray-400">{description}</p>
        )}
      </div>

      {isPending && (
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      )}

      {!isPending && isError && (
        <div className="flex h-40 items-center justify-center">
          <p className="text-xs text-gray-400">Could not load chart data.</p>
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
