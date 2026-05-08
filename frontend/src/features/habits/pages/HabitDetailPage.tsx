import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subDays, format } from 'date-fns';

import { PageHeader } from '../../../components/PageHeader';
import { DataState } from '../../../components/DataState';
import { useCurrentUser } from '../../auth/api/use-current-user';
import { useHabit } from '../api/use-habit';
import { resolveToday } from '../lib/today';
import { formatStreak, formatRate } from '../lib/streak';
import { HabitCalendarHeatmap } from '../components/HabitCalendarHeatmap';
import { HabitMiniAnalytics } from '../components/HabitMiniAnalytics';
import { HabitFormModal } from '../components/HabitFormModal';
import { HabitDeleteDialog } from '../components/HabitDeleteDialog';
import { FREQUENCY_LABELS } from '../schema/_frequency';

export function HabitDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const habitQuery = useHabit(id ?? '');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const today = user ? resolveToday(user.timezone) : format(new Date(), 'yyyy-MM-dd');
  const yearAgo = format(subDays(new Date(), 364), 'yyyy-MM-dd');

  return (
    <div>
      <div className="mb-1">
        <Link to="/habits" className="text-xs text-gray-400 hover:text-gray-600">
          ← Habits
        </Link>
      </div>

      <DataState
        isPending={habitQuery.isPending}
        isError={habitQuery.isError}
        data={habitQuery.data}
      >
        {(habit) => (
          <div className="space-y-6">
            <PageHeader
              title={habit.name}
              subtitle={`${FREQUENCY_LABELS[habit.frequencyType]} · Difficulty ${habit.difficulty}/5`}
              actions={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    className="rounded-lg border border-red-100 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Archive
                  </button>
                </div>
              }
            />

            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Current streak" value={formatStreak(habit.currentStreak)} />
              <StatCard label="30-day rate" value={formatRate(habit.completionRate30d)} />
              <StatCard
                label="Status"
                value={habit.todayStatus === 'completed' ? 'Done today ✓' : 'Pending'}
              />
            </div>

            {/* Heatmap */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Activity (last 365 days)</h2>
              <HabitCalendarHeatmap
                habitId={habit.id}
                habitCreatedAt={habit.createdAt}
                from={yearAgo}
                to={today}
              />
            </section>

            {/* Mini analytics */}
            <section>
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Patterns</h2>
              <HabitMiniAnalytics habitId={habit.id} />
            </section>

            <HabitFormModal open={editOpen} onClose={() => setEditOpen(false)} habit={habit} />
            <HabitDeleteDialog
              open={deleteOpen}
              onClose={() => setDeleteOpen(false)}
              habit={habit}
            />
          </div>
        )}
      </DataState>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
