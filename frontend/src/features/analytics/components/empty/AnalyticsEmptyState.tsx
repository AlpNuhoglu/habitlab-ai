import { Link } from 'react-router-dom';

export function AnalyticsEmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <span className="text-2xl" aria-hidden="true">📈</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-700">No patterns yet</p>
        <p className="mt-1 text-xs text-gray-400">
          Log at least 5 habits to start seeing your behavioral patterns.
        </p>
      </div>
      <Link
        to="/habits"
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        Go to habits
      </Link>
    </div>
  );
}
