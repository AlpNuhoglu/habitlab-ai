export type BoundaryKind =
  | 'root'
  | 'auth'
  | 'dashboard'
  | 'habits'
  | 'analytics'
  | 'coach'
  | 'settings'
  | 'notifications'
  | 'experiments'
  | 'tracker';

interface ErrorFallbackProps {
  kind: BoundaryKind;
  requestId: string | null;
  reset: () => void;
}

export function ErrorFallback({ kind, requestId, reset }: ErrorFallbackProps): React.ReactElement {
  if (kind === 'root') {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="text-sm text-gray-500">
          An unexpected error occurred. Please refresh the page.
        </p>
        {requestId && (
          <p className="text-xs text-gray-400">Error ID: {requestId}</p>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Refresh page
        </button>
      </div>
    );
  }

  return (
    <div role="alert" className="rounded-lg border border-red-100 bg-red-50 p-6 text-center">
      <p className="text-sm font-medium text-red-800">This section failed to load.</p>
      <p className="mt-1 text-xs text-red-600">
        We&apos;ve logged the issue. You can try again or navigate to another page.
      </p>
      {requestId && (
        <p className="mt-2 text-xs text-gray-400">Error ID: {requestId}</p>
      )}
      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
        <a
          href="/dashboard"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
