import { HabitForm } from './HabitForm';
import type { Habit } from '../types';

interface HabitFormModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly habit?: Habit; // present for edit mode
}

export function HabitFormModal({ open, onClose, habit }: HabitFormModalProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {habit ? 'Edit habit' : 'New habit'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <HabitForm
          mode={habit ? 'edit' : 'create'}
          {...(habit ? { habit } : {})}
          onSuccess={onClose}
        />
      </div>
    </div>
  );
}
