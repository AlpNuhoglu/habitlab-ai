import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { HabitListFilters } from '../types';

interface HabitsUIState {
  viewMode: 'grid' | 'list';
  filters: HabitListFilters;
  trackerFrom: string | null;
  trackerTo: string | null;
  setViewMode: (mode: 'grid' | 'list') => void;
  setFilters: (filters: Partial<HabitListFilters>) => void;
  setTrackerRange: (from: string, to: string) => void;
}

export const useHabitsUIStore = create<HabitsUIState>()(
  persist(
    (set) => ({
      viewMode: 'grid',
      filters: { status: 'active', sort: 'created-desc' },
      trackerFrom: null,
      trackerTo: null,
      setViewMode: (mode) => set({ viewMode: mode }),
      setFilters: (partial) =>
        set((s) => ({ filters: { ...s.filters, ...partial } })),
      setTrackerRange: (from, to) => set({ trackerFrom: from, trackerTo: to }),
    }),
    { name: 'habitlab-habits-ui' },
  ),
);
