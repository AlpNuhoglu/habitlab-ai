import { differenceInDays, parseISO } from 'date-fns';

import { useArchiveHabit } from '../api/use-archive-habit';
import { useDeleteHabit } from '../api/use-delete-habit';
import type { Habit } from '../types';

interface HabitDeleteDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly habit: Habit | null;
}

export function HabitDeleteDialog({ open, onClose, habit }: HabitDeleteDialogProps): React.ReactElement | null {
  const archive = useArchiveHabit();
  const hardDelete = useDeleteHabit();

  if (!open || !habit) return null;

  const ageInDays = differenceInDays(new Date(), parseISO(habit.createdAt));
  const canHardDelete = ageInDays < 30;

  function handleArchive(): void {
    if (!habit) return;
    archive.mutate(habit.id, { onSuccess: onClose });
  }

  function handleDelete(): void {
    if (!habit) return;
    hardDelete.mutate(habit.id, { onSuccess: onClose });
  }

  const isPending = archive.isPending || hardDelete.isPending;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Remove &ldquo;{habit.name}&rdquo;?</h2>
        <p className="mt-2 text-sm text-gray-500">
          Archiving hides the habit but keeps your history. Permanent deletion removes all data.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleArchive}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Archive (keep history)
          </button>

          {canHardDelete && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Delete permanently
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
