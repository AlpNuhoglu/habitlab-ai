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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-purple-500/30 bg-gray-950/90 backdrop-blur-md p-6 shadow-[0_0_40px_rgba(168,85,247,0.2)]">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            {habit ? 'Edit habit' : 'New habit'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
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
