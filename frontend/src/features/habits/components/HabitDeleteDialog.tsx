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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-purple-500/30 bg-gray-950/90 backdrop-blur-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.2)]">
        <h2 className="text-lg font-semibold text-gray-100">Remove &ldquo;{habit.name}&rdquo;?</h2>
        <p className="mt-2 text-sm text-gray-500">
          Archiving hides the habit but keeps your history. Permanent deletion removes all data.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleArchive}
            className="w-full rounded-lg border border-gray-700 py-2.5 text-sm font-medium text-gray-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-colors disabled:opacity-50"
          >
            Archive (keep history)
          </button>

          {canHardDelete && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleDelete}
              className="w-full rounded-lg border border-red-500/50 bg-red-900/20 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-900/40 transition-colors disabled:opacity-50"
            >
              Delete permanently
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-600 hover:text-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
