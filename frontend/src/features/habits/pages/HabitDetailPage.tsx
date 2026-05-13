import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subDays, format } from 'date-fns';

import { PageHeader } from '../../../components/PageHeader';
import { DataState } from '../../../components/DataState';
import { useCurrentUser } from '../../auth/api/use-current-user';
import { useHabit } from '../api/use-habit';
import { resolveToday } from '../lib/today';
import { formatStreak, formatRate } from '../lib/streak';
import { weekdayLabel, hourLabel } from '../../analytics/lib/format-axis';
import { HabitCalendarHeatmap } from '../components/HabitCalendarHeatmap';
import { HabitMiniAnalytics } from '../components/HabitMiniAnalytics';
import { HabitFormModal } from '../components/HabitFormModal';
import { HabitDeleteDialog } from '../components/HabitDeleteDialog';
import { FREQUENCY_LABELS } from '../schema/_frequency';
import { useHabitAnalytics } from '../../analytics/api/use-habit-analytics';
import { ChartFrame } from '../../analytics/components/charts/ChartFrame';
import { CompletionTrendLine } from '../../analytics/components/charts/CompletionTrendLine';
import { WeekdayBarChart } from '../../analytics/components/charts/WeekdayBarChart';
import { HourBarChart } from '../../analytics/components/charts/HourBarChart';
import { KpiTile } from '../../analytics/components/kpi/KpiTile';
import { KpiTileGrid } from '../../analytics/components/kpi/KpiTileGrid';
import type { CompletionTrendPoint, WeekdayBucket, HourBucket } from '../../analytics/types';

type Tab = 'overview' | 'analytics';

export function HabitDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { user } = useCurrentUser();
  const habitQuery = useHabit(id ?? '');
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const today = user ? resolveToday(user.timezone) : format(new Date(), 'yyyy-MM-dd');
  const yearAgo = format(subDays(new Date(), 364), 'yyyy-MM-dd');
  const locale = user?.locale ?? 'en';

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

            {/* Tab navigation */}
            <div className="flex gap-1 border-b border-gray-200">
              <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
                Overview
              </TabButton>
              <TabButton active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>
                Analytics
              </TabButton>
            </div>

            {activeTab === 'overview' && (
              <OverviewTab
                habit={habit}
                today={today}
                yearAgo={yearAgo}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsTab
                habitId={habit.id}
                habitCreatedAt={habit.createdAt}
                today={today}
                yearAgo={yearAgo}
                locale={locale}
              />
            )}

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

// ── Tab button ─────────────────────────────────────────────────────────────

interface TabButtonProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-b-2 border-gray-900 text-gray-900'
          : 'text-gray-400 hover:text-gray-600'
      }`}
    >
      {children}
    </button>
  );
}

// ── Overview tab ───────────────────────────────────────────────────────────

interface OverviewTabProps {
  readonly habit: { id: string; currentStreak: number; completionRate30d: number; todayStatus: string | null; createdAt: string };
  readonly today: string;
  readonly yearAgo: string;
}

function OverviewTab({ habit, today, yearAgo }: OverviewTabProps): React.ReactElement {
  return (
    <div className="space-y-6">
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
    </div>
  );
}

// ── Analytics tab ──────────────────────────────────────────────────────────

interface AnalyticsTabProps {
  readonly habitId: string;
  readonly habitCreatedAt: string;
  readonly today: string;
  readonly yearAgo: string;
  readonly locale: string;
}

function AnalyticsTab({ habitId, habitCreatedAt, today, yearAgo, locale }: AnalyticsTabProps): React.ReactElement {
  const analyticsQuery = useHabitAnalytics(habitId);
  const analytics = analyticsQuery.data;

  const trendPoints = useMemo<CompletionTrendPoint[]>(
    () => analytics?.monthlyTrend.map((p) => ({ month: p.month, rate: p.rate })) ?? [],
    [analytics],
  );

  const weekdayBuckets = useMemo<WeekdayBucket[]>(
    () =>
      analytics?.completionByWeekday.map((count, i) => ({
        weekday: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        count,
      })) ?? [],
    [analytics],
  );

  const hourBuckets = useMemo<HourBucket[]>(
    () =>
      analytics?.completionByHour.map((count, i) => ({ hour: i, count })) ?? [],
    [analytics],
  );

  const weekdayAccessible = useMemo<ReadonlyArray<readonly [string, string]>>(
    () =>
      weekdayBuckets.map(
        (b) => [weekdayLabel(b.weekday, locale), `${b.count} completions`] as const,
      ),
    [weekdayBuckets, locale],
  );

  const hourAccessible = useMemo<ReadonlyArray<readonly [string, string]>>(
    () =>
      hourBuckets
        .filter((b) => b.count > 0)
        .map((b) => [hourLabel(b.hour, locale, '24h'), `${b.count} completions`] as const),
    [hourBuckets, locale],
  );

  const trendAccessible = useMemo<ReadonlyArray<readonly [string, string]>>(
    () => trendPoints.map((p) => [p.month, `${Math.round(p.rate * 100)}%`] as const),
    [trendPoints],
  );

  const bestDayLabel =
    analytics?.completionByWeekday != null
      ? (() => {
          const idx = indexOfMax(analytics.completionByWeekday);
          return idx !== null ? weekdayLabel(idx as 0 | 1 | 2 | 3 | 4 | 5 | 6, locale) : '—';
        })()
      : '—';

  const bestTimeLabel =
    analytics?.completionByHour != null
      ? (() => {
          const idx = indexOfMax(analytics.completionByHour);
          return idx !== null ? hourLabel(idx, locale, '24h') : '—';
        })()
      : '—';

  return (
    <div className="space-y-4">
      <KpiTileGrid>
        <KpiTile label="Current streak" value={analytics ? formatStreak(analytics.currentStreak) : '—'} />
        <KpiTile label="Best streak" value={analytics ? formatStreak(analytics.longestStreak) : '—'} />
        <KpiTile
          label="Rate (30d)"
          value={analytics ? formatRate(analytics.completionRate30d) : '—'}
          hint="Based on the last 30 days regardless of when this habit was created."
        />
        <KpiTile label="All-time rate" value={analytics ? formatRate(analytics.completionRateAllTime) : '—'} />
      </KpiTileGrid>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartFrame
          title="Completion trend"
          isPending={analyticsQuery.isPending}
          isError={analyticsQuery.isError}
          accessibleData={trendAccessible}
        >
          <CompletionTrendLine data={trendPoints} />
        </ChartFrame>

        <ChartFrame
          title="Best days of week"
          description="When you actually complete this habit"
          isPending={analyticsQuery.isPending}
          isError={analyticsQuery.isError}
          accessibleData={weekdayAccessible}
        >
          <WeekdayBarChart data={weekdayBuckets} locale={locale} />
        </ChartFrame>

        <ChartFrame
          title="When you complete"
          description="Hour of day (your timezone)"
          isPending={analyticsQuery.isPending}
          isError={analyticsQuery.isError}
          accessibleData={hourAccessible}
        >
          <HourBarChart data={hourBuckets} locale={locale} format="24h" />
        </ChartFrame>

        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Best patterns</h3>
          <div className="flex gap-6">
            <Stat label="Best weekday" value={bestDayLabel} />
            <Stat label="Best time" value={bestTimeLabel} />
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Activity (last 365 days)</h2>
        <HabitCalendarHeatmap
          habitId={habitId}
          habitCreatedAt={habitCreatedAt}
          from={yearAgo}
          to={today}
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function indexOfMax(arr: readonly number[]): number | null {
  if (arr.length === 0) return null;
  let maxIdx = 0;
  let maxVal = arr[0] ?? 0;
  for (let i = 1; i < arr.length; i++) {
    const v = arr[i] ?? 0;
    if (v > maxVal) {
      maxVal = v;
      maxIdx = i;
    }
  }
  return maxVal === 0 ? null : maxIdx;
}

function StatCard({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
