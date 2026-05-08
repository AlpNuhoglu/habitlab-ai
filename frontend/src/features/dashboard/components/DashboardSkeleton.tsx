export function DashboardSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-6">
      {/* Greeting */}
      <div className="h-8 w-48 rounded-lg bg-gray-200" />

      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>

      {/* Today list */}
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-gray-200" />
        ))}
      </div>
    </div>
  );
}
