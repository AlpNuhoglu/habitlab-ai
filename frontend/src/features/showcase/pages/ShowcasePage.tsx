import { useState, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ShowcaseTab = 'dashboard' | 'matrix' | 'copilot' | 'performance';
type MessageRole = 'user' | 'assistant';
type GoalStatus = 'completed' | 'active' | 'upcoming';
type CellIntensity = 0 | 1 | 2 | 3 | 4;

interface ShowcaseHabit {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly streak: number;
  readonly completionRate: number;
  readonly weekDots: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  completed: boolean;
}

interface MatrixCell {
  readonly date: string;
  readonly intensity: CellIntensity;
}

interface DonutSegment {
  readonly label: string;
  readonly value: number;
  readonly color: string;
}

interface ChatMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly text: string;
  readonly timestamp: string;
}

interface GoalStep {
  readonly id: string;
  readonly label: string;
  readonly sublabel: string;
  readonly status: GoalStatus;
}

interface MetricRow {
  readonly label: string;
  readonly value: string;
  readonly delta: string;
  readonly positive: boolean;
}

interface IconProps {
  readonly className?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_HABITS: ShowcaseHabit[] = [
  {
    id: 'h1',
    name: 'Morning Mindfulness',
    emoji: '🧘',
    streak: 32,
    completionRate: 0.94,
    weekDots: [true, true, true, false, true, true, true],
    completed: true,
  },
  {
    id: 'h2',
    name: 'Deep Work Session',
    emoji: '⚡',
    streak: 31,
    completionRate: 0.88,
    weekDots: [true, true, false, true, true, false, true],
    completed: false,
  },
  {
    id: 'h3',
    name: 'Daily Steps (10k)',
    emoji: '👟',
    streak: 14,
    completionRate: 0.76,
    weekDots: [true, false, true, true, true, false, false],
    completed: false,
  },
];

const INTENSITY_PATTERN: readonly CellIntensity[] = [
  4, 4, 4, 4, 4,
  3, 3, 3, 3, 3,
  2, 3, 2, 4, 1,
  0, 2, 3, 4, 2,
  1, 0, 2, 3, 4,
  3, 2, 1, 0, 2,
];

function buildMatrixCells(): MatrixCell[] {
  const cells: MatrixCell[] = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10) ?? '';
    const intensity: CellIntensity = INTENSITY_PATTERN[29 - i] ?? 0;
    cells.push({ date: dateStr, intensity });
  }
  return cells;
}

const MATRIX_CELLS: MatrixCell[] = buildMatrixCells();

const DONUT_SEGMENTS: readonly DonutSegment[] = [
  { label: 'Health', value: 45, color: '#06b6d4' },
  { label: 'Career', value: 30, color: '#6366f1' },
  { label: 'Mindset', value: 25, color: '#10b981' },
];

const INITIAL_MESSAGES: readonly ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    text: 'How do I stay consistent on weekends?',
    timestamp: '10:41 AM',
  },
  {
    id: 'm2',
    role: 'assistant',
    text: "Great question! Schedule lighter 'maintenance' habits – even 5 minutes of your core habit keeps the streak alive. I'll adjust your Sunday plan.",
    timestamp: '10:42 AM',
  },
];

const CANNED_REPLIES: readonly string[] = [
  "Consistency compounds. Your 94% compliance this week puts you in the top 12% of users.",
  "Try pairing 'Morning Mindfulness' with your first coffee – I see a 34% higher completion rate with that anchor.",
  "You've earned the 'Early Riser' badge. Want to optimise your 5 AM peak energy window?",
];

const GOAL_STEPS: readonly GoalStep[] = [
  { id: 'g1', label: 'Foundation', sublabel: 'Complete 7 days', status: 'completed' },
  { id: 'g2', label: 'Momentum', sublabel: '14 day streak', status: 'active' },
  { id: 'g3', label: 'Mastery', sublabel: '30 day streak + 80%', status: 'upcoming' },
];

const SYSTEM_METRICS: readonly MetricRow[] = [
  { label: 'Focus Score', value: '88', delta: '+12%', positive: true },
  { label: 'Recovery Balance', value: '72', delta: '+5%', positive: true },
  { label: 'Task Completion', value: '94', delta: '-3%', positive: false },
  { label: 'Peak Energy', value: '5 AM / 11 AM', delta: 'optimised', positive: true },
];

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconBrain({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2a2.5 2.5 0 0 1 5 0c.83 0 1.5.67 1.5 1.5v1c0 .83-.67 1.5-1.5 1.5h-5A1.5 1.5 0 0 1 8 4.5v-1C8 2.67 8.67 2 9.5 2Z" />
      <path d="M9 6c-2.21 0-4 1.79-4 4 0 1.5.82 2.81 2.04 3.51A4 4 0 0 0 9 17v1a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1a4 4 0 0 0 1.96-3.49C18.18 12.81 19 11.5 19 10c0-2.21-1.79-4-4-4" />
    </svg>
  );
}

function IconCheck({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconSend({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function IconFire({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17h2a2.5 2.5 0 0 0 0-5H11a2.5 2.5 0 0 1 0-5c1.38 0 2.5.5 2.5 2" />
      <path d="M12 3v1m0 16v1" />
    </svg>
  );
}

function IconBell({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconUser({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconSparkle({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.68 5.16a2 2 0 0 0 1.26 1.26L21 11l-6.06 1.58a2 2 0 0 0-1.26 1.26L12 21l-1.68-5.16a2 2 0 0 0-1.26-1.26L3 13l6.06-1.58a2 2 0 0 0 1.26-1.26L12 3z" />
    </svg>
  );
}

function IconBot({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M9 15h.01M15 15h.01" />
      <path d="M12 11V7" />
      <circle cx="12" cy="5" r="2" />
    </svg>
  );
}

function IconTarget({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconChevronRight({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Shared Primitives ────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-zinc-900/50 backdrop-blur-md border border-zinc-800 ${className}`}>
      {children}
    </div>
  );
}

function StatPill({ children, color = 'cyan' }: { children: React.ReactNode; color?: 'cyan' | 'indigo' | 'emerald' }) {
  const colorMap = {
    cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/40',
    indigo: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/40',
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colorMap[color]}`}>
      {children}
    </span>
  );
}

// ─── TopNav ───────────────────────────────────────────────────────────────────

function TopNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600">
            <IconBrain className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">HabitLab AI</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors">
            <IconBell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-medium transition-all duration-200 shadow-lg shadow-indigo-900/40">
            Get Started
          </button>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
            <IconUser className="h-4 w-4" />
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

const TABS: { key: ShowcaseTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'matrix', label: 'Habit Matrix' },
  { key: 'copilot', label: 'AI Co-pilot' },
  { key: 'performance', label: 'Performance' },
];

function TabBar({ active, onSelect }: { active: ShowcaseTab; onSelect: (t: ShowcaseTab) => void }) {
  return (
    <div className="border-b border-zinc-800 bg-[#09090b]/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className={`px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2 -mb-px ${
              active === tab.key
                ? 'text-cyan-400 border-cyan-400'
                : 'text-zinc-400 border-transparent hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function AIInsightBanner() {
  const [applied, setApplied] = useState(false);
  return (
    <div className="rounded-2xl bg-gradient-to-r from-cyan-950/60 to-indigo-950/60 border border-cyan-800/40 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-start gap-3 flex-1">
        <div className="mt-0.5 flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
          <IconSparkle className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-1">AI Insight</p>
          <p className="text-sm text-zinc-200 leading-relaxed">
            Your peak productivity window is <span className="text-cyan-300 font-medium">5–9 AM</span>. Move your Deep Work session to <span className="text-cyan-300 font-medium">8 AM</span> for <span className="text-emerald-400 font-semibold">+22% focus</span>.
          </p>
        </div>
      </div>
      <button
        onClick={() => setApplied(true)}
        className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
          applied
            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-700/40 cursor-default'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
        }`}
      >
        {applied ? '✓ Applied' : 'Apply Schedule'}
      </button>
    </div>
  );
}

function HabitCardItem({
  habit,
  onToggle,
}: {
  habit: ShowcaseHabit;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 transition-all duration-300 ${
        habit.completed
          ? 'border-emerald-800/50 bg-emerald-950/20'
          : 'border-zinc-800 bg-zinc-900/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{habit.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-zinc-100">{habit.name}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <IconFire className="h-3 w-3 text-orange-400" />
              <span className="text-xs text-zinc-400">{habit.streak} day streak</span>
            </div>
          </div>
        </div>
        {/* Toggle */}
        <button
          onClick={() => onToggle(habit.id)}
          className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
            habit.completed
              ? 'border-emerald-500 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
              : 'border-zinc-600 bg-transparent hover:border-cyan-500'
          }`}
          aria-label={habit.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {habit.completed && <IconCheck className="h-3.5 w-3.5 text-white" />}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-zinc-500">Completion rate</span>
          <span className="text-xs font-semibold text-zinc-300">{Math.round(habit.completionRate * 100)}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              habit.completed
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                : 'bg-gradient-to-r from-cyan-600 to-indigo-500'
            }`}
            style={{ width: `${habit.completionRate * 100}%` }}
          />
        </div>
      </div>

      {/* Week dots */}
      <div className="flex items-center justify-between">
        {WEEK_LABELS.map((label, i) => {
          const done = habit.weekDots[i] ?? false;
          return (
            <div key={`${habit.id}-${i}`} className="flex flex-col items-center gap-1">
              <div
                className={`w-5 h-5 rounded-full transition-all duration-200 ${
                  done
                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    : 'bg-zinc-800 border border-zinc-700'
                }`}
              />
              <span className="text-[10px] text-zinc-600">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyDotsWidget({ habit }: { habit: ShowcaseHabit | undefined }) {
  if (!habit) return null;
  const completedCount = habit.weekDots.filter(Boolean).length;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-200">This week's consistency</h3>
        <StatPill color="emerald">{completedCount}/7 days</StatPill>
      </div>
      <div className="flex items-center justify-between">
        {WEEK_LABELS.map((label, i) => {
          const done = habit.weekDots[i] ?? false;
          return (
            <div key={`wd-${i}`} className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-200 ${
                  done
                    ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : 'bg-zinc-800/80 border border-zinc-700 text-zinc-600'
                }`}
              >
                {done ? <IconCheck className="h-3.5 w-3.5" /> : label}
              </div>
              <span className="text-[10px] text-zinc-500">{label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DashboardTab() {
  const [habits, setHabits] = useState<ShowcaseHabit[]>(INITIAL_HABITS);

  function toggleHabit(id: string) {
    setHabits((prev) =>
      prev.map((h) => (h.id === id ? { ...h, completed: !h.completed } : h)),
    );
  }

  return (
    <div className="space-y-6">
      <AIInsightBanner />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {habits.map((habit) => (
          <HabitCardItem key={habit.id} habit={habit} onToggle={toggleHabit} />
        ))}
      </div>

      <WeeklyDotsWidget habit={habits[0]} />
    </div>
  );
}

// ─── Habit Matrix Tab ─────────────────────────────────────────────────────────

const INTENSITY_FILLS: Record<CellIntensity, string> = {
  0: '#27272a',
  1: '#164e63',
  2: '#0e7490',
  3: '#06b6d4',
  4: '#67e8f9',
};

function ContributionGrid({ cells }: { cells: readonly MatrixCell[] }) {
  const COLS = 5;
  const ROWS = 6;
  const CELL = 12;
  const GAP = 3;
  const W = COLS * (CELL + GAP) - GAP;
  const H = ROWS * (CELL + GAP) - GAP;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="30-day contribution grid">
      {cells.map((cell, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const x = col * (CELL + GAP);
        const y = row * (CELL + GAP);
        const fill = INTENSITY_FILLS[cell.intensity] ?? INTENSITY_FILLS[0];
        return (
          <rect
            key={cell.date}
            x={x}
            y={y}
            width={CELL}
            height={CELL}
            rx={3}
            fill={fill}
          >
            <title>{`${cell.date}: intensity ${cell.intensity}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function DonutChart({ segments }: { segments: readonly DonutSegment[] }) {
  const R = 40;
  const CX = 60;
  const CY = 60;
  const CIRCUMFERENCE = 2 * Math.PI * R;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  let cumulative = 0;

  return (
    <svg viewBox="0 0 120 120" width={160} height={160} role="img" aria-label="Habit category donut chart">
      {/* Background ring */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#27272a" strokeWidth={18} />

      {/* Rotate so first segment starts at top */}
      <g transform={`rotate(-90 ${CX} ${CY})`}>
        {segments.map((seg) => {
          const arcLen = Math.max(0.01, (seg.value / total) * CIRCUMFERENCE);
          const offset = cumulative;
          cumulative += arcLen;

          return (
            <circle
              key={seg.label}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={18}
              strokeDasharray={`${arcLen} ${CIRCUMFERENCE}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
        })}
      </g>

      {/* Centre text */}
      <text x={CX} y={CY - 5} textAnchor="middle" fill="#f4f4f5" fontSize={16} fontWeight={700}>
        70%
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" fill="#a1a1aa" fontSize={9}>
        overall
      </text>
    </svg>
  );
}

function HabitMatrixTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contribution grid */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Activity Matrix</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Last 30 days</p>
            </div>
            <StatPill color="cyan">30 days</StatPill>
          </div>
          <div className="flex justify-center">
            <ContributionGrid cells={MATRIX_CELLS} />
          </div>
          <div className="flex items-center gap-2 mt-4 justify-end">
            <span className="text-[10px] text-zinc-600">Less</span>
            {([0, 1, 2, 3, 4] as CellIntensity[]).map((lvl) => (
              <div
                key={lvl}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: INTENSITY_FILLS[lvl] }}
              />
            ))}
            <span className="text-[10px] text-zinc-600">More</span>
          </div>
        </Card>

        {/* Donut chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">Habit Categories</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Completion breakdown</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-8">
            <DonutChart segments={DONUT_SEGMENTS} />
            <div className="space-y-3">
              {DONUT_SEGMENTS.map((seg) => (
                <div key={seg.label} className="flex items-center gap-2.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <div>
                    <p className="text-xs text-zinc-300 font-medium">{seg.label}</p>
                    <p className="text-[11px] text-zinc-500">{seg.value}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Stats row */}
      <Card className="p-5">
        <div className="flex flex-wrap gap-3 items-center justify-center sm:justify-start">
          <StatPill color="cyan">
            <IconSparkle className="h-3 w-3" />
            94.2% Consistency
          </StatPill>
          <StatPill color="emerald">
            <IconFire className="h-3 w-3" />
            21 day streak
          </StatPill>
          <StatPill color="indigo">
            <IconTarget className="h-3 w-3" />
            Top 8% of users
          </StatPill>
          <StatPill color="cyan">Longest Streak: 21 days</StatPill>
        </div>
      </Card>
    </div>
  );
}

// ─── AI Co-pilot Tab ──────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'How to build a new habit?',
  'Why do I fail after 2 weeks?',
  'Optimise my morning routine',
] as const;

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      {!isUser && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center mr-2.5 mt-0.5 shadow-lg shadow-cyan-900/30">
          <IconBot className="h-3.5 w-3.5 text-white" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-tr-sm bg-indigo-600 text-white shadow-lg shadow-indigo-900/30'
            : 'rounded-tl-sm bg-zinc-800 text-zinc-100 border border-zinc-700/50'
        }`}
      >
        <p className="text-sm leading-relaxed">{message.text}</p>
        <p className={`text-[10px] mt-1.5 ${isUser ? 'text-indigo-300' : 'text-zinc-500'}`}>
          {message.timestamp}
        </p>
      </div>
    </div>
  );
}

function AICopilotTab() {
  const [messages, setMessages] = useState<ChatMessage[]>([...INITIAL_MESSAGES]);
  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function getTimestamp(): string {
    const now = new Date();
    const h = now.getHours() % 12 || 12;
    const m = String(now.getMinutes()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    return `${h}:${m} ${ampm}`;
  }

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: 'user',
      text: trimmed,
      timestamp: getTimestamp(),
    };

    setMessages((prev) => {
      const next = [...prev, userMsg];
      const idx = next.length % CANNED_REPLIES.length;
      const replyText = CANNED_REPLIES[idx] ?? CANNED_REPLIES[0] ?? 'Got it!';
      const aiMsg: ChatMessage = {
        id: String(Date.now() + 1),
        role: 'assistant',
        text: replyText,
        timestamp: getTimestamp(),
      };
      return [...next, aiMsg];
    });

    setInputValue('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend(inputValue);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 h-[600px]">
      {/* Left panel */}
      <Card className="p-5 flex flex-col gap-4 overflow-hidden">
        {/* AI Avatar */}
        <div className="flex flex-col items-center py-4 border-b border-zinc-800">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-cyan-900/30">
              <IconBot className="h-8 w-8 text-white" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#09090b] shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-200">HabitLab AI</p>
          <p className="text-xs text-emerald-400 mt-0.5">● Online</p>
        </div>

        {/* Quick prompts */}
        <div>
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2.5">Quick Prompts</p>
          <div className="space-y-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                className="w-full text-left px-3 py-2.5 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 hover:border-cyan-800/60 text-xs text-zinc-300 hover:text-zinc-100 transition-all duration-200 flex items-center justify-between group"
              >
                <span>{prompt}</span>
                <IconChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-cyan-500 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Right chat area */}
      <Card className="flex flex-col overflow-hidden p-0">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-600 to-indigo-600 flex items-center justify-center">
            <IconBot className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-200">AI Co-pilot</p>
            <p className="text-[11px] text-emerald-400">Always here to help</p>
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-5 py-4 border-t border-zinc-800">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your habits..."
            className="flex-1 rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-cyan-700 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all duration-200 shadow-lg shadow-indigo-900/30"
          >
            <IconSend className="h-4 w-4" />
          </button>
        </form>
      </Card>
    </div>
  );
}

// ─── Performance Tab ──────────────────────────────────────────────────────────

function GoalRoadmap({ steps }: { steps: readonly GoalStep[] }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <IconTarget className="h-4 w-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-zinc-200">Goal Roadmap</h3>
      </div>
      <div className="flex items-start">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-start flex-1">
            <div className="flex flex-col items-center w-full">
              {/* Step node */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  step.status === 'completed'
                    ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.5)]'
                    : step.status === 'active'
                    ? 'bg-transparent border-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                    : 'bg-transparent border-zinc-700'
                }`}
              >
                {step.status === 'completed' ? (
                  <IconCheck className="h-4 w-4 text-white" />
                ) : step.status === 'active' ? (
                  <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                )}
              </div>

              {/* Labels */}
              <div className="mt-3 text-center px-2">
                <p
                  className={`text-xs font-semibold ${
                    step.status === 'completed'
                      ? 'text-emerald-400'
                      : step.status === 'active'
                      ? 'text-cyan-300'
                      : 'text-zinc-500'
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{step.sublabel}</p>
              </div>
            </div>

            {/* Connector line (not after last) */}
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 mt-5 mx-1 ${
                  step.status === 'completed' ? 'bg-emerald-600/60' : 'bg-zinc-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function SystemMetricsPanel({ metrics }: { metrics: readonly MetricRow[] }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <IconSparkle className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-zinc-200">System Intelligence</h3>
        <span className="ml-auto text-[10px] text-emerald-400 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          Live
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-zinc-500 mb-1">{metric.label}</p>
              <p className="text-xl font-bold text-zinc-100 tracking-tight">{metric.value}</p>
            </div>
            <span
              className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                metric.positive
                  ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
                  : 'text-red-400 bg-red-950/60 border border-red-800/40'
              }`}
            >
              {metric.delta}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PerformanceTab() {
  return (
    <div className="space-y-6">
      <GoalRoadmap steps={GOAL_STEPS} />
      <SystemMetricsPanel metrics={SYSTEM_METRICS} />
    </div>
  );
}

// ─── ShowcasePage (root export) ────────────────────────────────────────────────

export function ShowcasePage() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('dashboard');

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 font-sans">
      <TopNav />
      <TabBar active={activeTab} onSelect={setActiveTab} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'matrix' && <HabitMatrixTab />}
        {activeTab === 'copilot' && <AICopilotTab />}
        {activeTab === 'performance' && <PerformanceTab />}
      </main>
    </div>
  );
}
