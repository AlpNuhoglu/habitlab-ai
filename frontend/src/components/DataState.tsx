interface DataStateProps<T> {
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly data: T | undefined;
  readonly skeleton?: React.ReactNode;
  readonly empty?: React.ReactNode;
  readonly children: (data: T) => React.ReactNode;
}

export function DataState<T>({
  isPending,
  isError,
  data,
  skeleton,
  empty,
  children,
}: DataStateProps<T>): React.ReactElement {
  if (isPending) {
    return (
      <>{skeleton ?? <DefaultSkeleton />}</>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Something went wrong. Please refresh the page.
      </div>
    );
  }

  if (data == null || (Array.isArray(data) && data.length === 0)) {
    return <>{empty ?? null}</>;
  }

  return <>{children(data)}</>;
}

function DefaultSkeleton(): React.ReactElement {
  return (
    <div className="space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-gray-200" />
      ))}
    </div>
  );
}
