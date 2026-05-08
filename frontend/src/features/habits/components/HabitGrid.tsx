import type { Habit } from '../types';
import { HabitCard } from './HabitCard';

interface HabitGridProps {
  readonly habits: Habit[];
  readonly viewMode?: 'grid' | 'list' | undefined;
  readonly onEdit?: ((habit: Habit) => void) | undefined;
  readonly onDelete?: ((habit: Habit) => void) | undefined;
}

export function HabitEmptyState({ onNew }: { onNew?: () => void }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
      <div className="mb-3 text-4xl">🌱</div>
      <p className="text-sm font-medium text-gray-700">No habits yet</p>
      <p className="mt-1 text-xs text-gray-400">Create your first habit to start tracking.</p>
      {onNew && (
        <button
          type="button"
          onClick={onNew}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Create habit
        </button>
      )}
    </div>
  );
}

export function HabitGrid({
  habits,
  viewMode = 'grid',
  onEdit,
  onDelete,
}: HabitGridProps): React.ReactElement {
  if (viewMode === 'list') {
    return (
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white px-4">
        {habits.map((h) => (
          <HabitCard
            key={h.id}
            habit={h}
            variant="row"
            {...(onEdit ? { onEdit } : {})}
            {...(onDelete ? { onDelete } : {})}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {habits.map((h) => (
        <HabitCard
          key={h.id}
          habit={h}
          variant="default"
          {...(onEdit ? { onEdit } : {})}
          {...(onDelete ? { onDelete } : {})}
        />
      ))}
    </div>
  );
}
