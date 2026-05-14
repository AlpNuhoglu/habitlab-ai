interface Props {
  readonly hasHabits: boolean;
}

export function CoachEmptyState({ hasHabits }: Props): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-200 py-16 text-center">
      <span className="text-4xl text-gray-300" aria-hidden="true">💡</span>
      {hasHabits ? (
        <>
          <p className="text-sm font-medium text-gray-600">No insights yet</p>
          <p className="max-w-xs text-xs text-gray-400">
            Keep logging — insights appear after consistent tracking
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-600">No habits yet</p>
          <p className="max-w-xs text-xs text-gray-400">
            Create a habit to get started — insights will appear as you build a history
          </p>
        </>
      )}
    </div>
  );
}
