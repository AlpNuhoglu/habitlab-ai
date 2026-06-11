import { useState } from 'react';

import { PageHeader } from '../../../components/PageHeader';
import { DataState } from '../../../components/DataState';
import { useHabits } from '../api/use-habits';
import { useHabitsUIStore } from '../store/habits-ui-store';
import { HabitGrid, HabitEmptyState } from '../components/HabitGrid';
import { HabitFormModal } from '../components/HabitFormModal';
import { HabitDeleteDialog } from '../components/HabitDeleteDialog';
import type { Habit, HabitListFilters } from '../types';

export function HabitsPage(): React.ReactElement {
  const { viewMode, filters, setViewMode, setFilters } = useHabitsUIStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Habit | undefined>();
  const [deleting, setDeleting] = useState<Habit | null>(null);

  const habitsQuery = useHabits(filters as HabitListFilters);

  function openCreate(): void {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(habit: Habit): void {
    setEditing(habit);
    setModalOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Habits"
        subtitle="Track and manage your habits."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg border border-purple-500/50 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-500/20 hover:border-purple-400 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] transition-all"
          >
            + New habit
          </button>
        }
      />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['active', 'archived', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilters({ status: s })}
            className={`rounded-full px-3 py-1 text-xs font-medium tracking-wider uppercase transition-all ${
              filters.status === s
                ? 'border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                : 'border border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {s}
          </button>
        ))}

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`rounded p-1.5 transition-colors ${viewMode === 'grid' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-600 hover:text-gray-400'}`}
            aria-label="Grid view"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded p-1.5 transition-colors ${viewMode === 'list' ? 'bg-purple-500/20 text-purple-400' : 'text-gray-600 hover:text-gray-400'}`}
            aria-label="List view"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      <DataState
        isPending={habitsQuery.isPending}
        isError={habitsQuery.isError}
        data={habitsQuery.data}
        empty={<HabitEmptyState onNew={openCreate} />}
      >
        {(habits) => (
          <HabitGrid
            habits={habits}
            viewMode={viewMode}
            onEdit={openEdit}
            onDelete={(h) => setDeleting(h)}
          />
        )}
      </DataState>

      <HabitFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        {...(editing ? { habit: editing } : {})}
      />
      <HabitDeleteDialog
        open={deleting != null}
        onClose={() => setDeleting(null)}
        habit={deleting}
      />
    </div>
  );
}
