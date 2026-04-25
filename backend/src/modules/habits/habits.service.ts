import { createHash } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { CreateHabitDto } from './dto/create-habit.dto';
import { UpdateHabitDto } from './dto/update-habit.dto';
import { Habit } from './entities/habit.entity';
import { HabitLog } from './entities/habit-log.entity';
import { HabitLogStatus } from './entities/habit-log.entity';
import { ListHabitsOptions } from './repositories/habit.repository';
import { HabitRepository } from './repositories/habit.repository';
import { HabitLogRepository } from './repositories/habit-log.repository';

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns today's date string in YYYY-MM-DD using the user's IANA timezone. */
export function todayInTimezone(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function validateLogDate(logDate: string, timezone: string): void {
  const today = todayInTimezone(timezone);
  const sevenDaysAgo = subtractDays(today, 7);

  if (logDate > today) {
    throw new BadRequestException({ code: 'FUTURE_DATE', message: 'Cannot log for a future date.' });
  }
  if (logDate < sevenDaysAgo) {
    throw new BadRequestException({
      code: 'RETRO_LIMIT_EXCEEDED',
      message: 'Cannot log more than 7 days in the past.',
    });
  }
}

// ─── Streak helpers (exported for testing) ────────────────────────────────────

/**
 * Computes the current streak for a habit.
 *
 * Rules (FR-044):
 *  - Skipped / unlogged days break the streak.
 *  - Today with no log counts as "in progress" — does not break the streak.
 *  - Note: weekly/custom habits use the same day-level logic in WP3.
 *    WP5 will revise to week-level satisfied-week semantics.
 */
export function computeCurrentStreak(completedDatesSorted: string[], today: string): number {
  const dateSet = new Set(completedDatesSorted);
  let streak = 0;

  // Start from today if completed; otherwise from yesterday (in-progress today is OK).
  let cursor = dateSet.has(today) ? today : subtractDays(today, 1);

  while (dateSet.has(cursor)) {
    streak++;
    cursor = subtractDays(cursor, 1);
  }

  return streak;
}

/**
 * Computes the all-time longest streak from an ascending sorted list of completed dates.
 */
export function computeLongestStreak(completedDatesSorted: string[]): number {
  if (completedDatesSorted.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < completedDatesSorted.length; i++) {
    const prev = new Date((completedDatesSorted[i - 1] as string) + 'T00:00:00Z');
    const curr = new Date((completedDatesSorted[i] as string) + 'T00:00:00Z');
    const diffDays = (curr.getTime() - prev.getTime()) / 86_400_000;

    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }

  return longest;
}

/** completion_rate_30d = completed count in last 30 days / 30 (denominator always 30). */
export function computeCompletionRate30d(logs: HabitLog[], today: string): number {
  const from = subtractDays(today, 29);
  const completed = logs.filter(
    (l) => l.status === 'completed' && l.logDate >= from && l.logDate <= today,
  );
  return Math.round((completed.length / 30) * 100) / 100;
}

// ─── Event helper shape ───────────────────────────────────────────────────────

interface EmitEventArgs {
  userId: string;
  eventType: string;
  aggregateType: string;
  aggregateId?: string;
  payload: Record<string, unknown>;
}

// ─── Public DTO shapes ────────────────────────────────────────────────────────

export interface HabitDto {
  id: string;
  name: string;
  description: string | null;
  frequencyType: string;
  weekdayMask: number | null;
  targetCountPerWeek: number | null;
  preferredTime: string | null;
  difficulty: number;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HabitDetailDto extends HabitDto {
  currentStreak: number;
  longestStreak: number;
  completionRate30d: number;
}

export interface HabitListDto {
  data: HabitDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardHabitDto {
  id: string;
  name: string;
  frequencyType: string;
  preferredTime: string | null;
  currentStreak: number;
  completionRate30d: number;
  todayStatus: 'completed' | 'skipped' | 'pending';
}

export interface DashboardSummaryDto {
  activeHabits: number;
  todayCompleted: number;
  todaySkipped: number;
  todayPending: number;
  overallCompletionRate30d: number;
  longestStreakAnyHabit: number;
}

export interface DashboardDto {
  summary: DashboardSummaryDto;
  habits: DashboardHabitDto[];
  activeRecommendations: unknown[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class HabitsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly habitRepo: HabitRepository,
    private readonly habitLogRepo: HabitLogRepository,
  ) {}

  // ─── List habits (FR-021) ──────────────────────────────────────────────────

  async listHabits(userId: string, opts: ListHabitsOptions): Promise<HabitListDto> {
    const [habits, total] = await this.habitRepo.findAll(userId, opts);
    return {
      data: habits.map(toHabitDto),
      total,
      limit: opts.limit,
      offset: opts.offset,
    };
  }

  // ─── Create habit (FR-020) ────────────────────────────────────────────────

  async createHabit(userId: string, dto: CreateHabitDto): Promise<HabitDto> {
    return this.dataSource.transaction(async (em) => {
      const habit = await em.save(
        em.create(Habit, {
          userId,
          name: dto.name,
          description: dto.description ?? null,
          frequencyType: dto.frequencyType,
          weekdayMask: dto.weekdayMask ?? null,
          targetCountPerWeek: dto.targetCountPerWeek ?? null,
          preferredTime: dto.preferredTime ?? null,
          difficulty: dto.difficulty ?? 3,
        }),
      );

      await this.emitEvent(em, {
        userId,
        eventType: 'habit.created',
        aggregateType: 'habit',
        aggregateId: habit.id,
        payload: {
          name: habit.name,
          frequencyType: habit.frequencyType,
          difficulty: habit.difficulty,
        },
      });

      return toHabitDto(habit);
    });
  }

  // ─── Get single habit (FR-022) ────────────────────────────────────────────

  async getHabit(userId: string, habitId: string): Promise<HabitDetailDto> {
    const habit = await this.habitRepo.findOne(userId, habitId);
    if (!habit) throw new NotFoundException();

    const timezone = await this.getUserTimezone(userId);
    const today = todayInTimezone(timezone);
    const completedDates = await this.habitLogRepo.findCompletedDates(userId, habitId);
    const last30 = await this.habitLogRepo.findLast30Days(userId, habitId, today);

    return {
      ...toHabitDto(habit),
      currentStreak: computeCurrentStreak(completedDates, today),
      longestStreak: computeLongestStreak(completedDates),
      completionRate30d: computeCompletionRate30d(last30, today),
    };
  }

  // ─── Update habit (FR-023) ────────────────────────────────────────────────

  async updateHabit(userId: string, habitId: string, dto: UpdateHabitDto): Promise<HabitDetailDto> {
    const before = await this.habitRepo.findOne(userId, habitId);
    if (!before) throw new NotFoundException();

    const diff = buildDiff(before, dto);

    const updated = await this.dataSource.transaction(async (em) => {
      const habit = await em.save(
        Object.assign(before, {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.frequencyType !== undefined ? { frequencyType: dto.frequencyType } : {}),
          ...(dto.weekdayMask !== undefined ? { weekdayMask: dto.weekdayMask } : {}),
          ...(dto.targetCountPerWeek !== undefined ? { targetCountPerWeek: dto.targetCountPerWeek } : {}),
          ...(dto.preferredTime !== undefined ? { preferredTime: dto.preferredTime } : {}),
          ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        }),
      );

      if (Object.keys(diff).length > 0) {
        await this.emitEvent(em, {
          userId,
          eventType: 'habit.updated',
          aggregateType: 'habit',
          aggregateId: habitId,
          payload: { diff },
        });
      }

      return habit;
    });

    const timezone = await this.getUserTimezone(userId);
    const today = todayInTimezone(timezone);
    const completedDates = await this.habitLogRepo.findCompletedDates(userId, habitId);
    const last30 = await this.habitLogRepo.findLast30Days(userId, habitId, today);

    return {
      ...toHabitDto(updated),
      currentStreak: computeCurrentStreak(completedDates, today),
      longestStreak: computeLongestStreak(completedDates),
      completionRate30d: computeCompletionRate30d(last30, today),
    };
  }

  // ─── Archive habit (FR-024) ───────────────────────────────────────────────

  async archiveHabit(userId: string, habitId: string): Promise<void> {
    const habit = await this.habitRepo.findOne(userId, habitId);
    if (!habit) throw new NotFoundException();

    await this.dataSource.transaction(async (em) => {
      await em.update(Habit, { id: habitId, userId }, { archivedAt: new Date(), isActive: false });
      await this.emitEvent(em, {
        userId,
        eventType: 'habit.archived',
        aggregateType: 'habit',
        aggregateId: habitId,
        payload: {},
      });
    });
  }

  // ─── Hard delete (FR-025) ─────────────────────────────────────────────────

  async hardDeleteHabit(userId: string, habitId: string): Promise<void> {
    const habit = await this.habitRepo.findOne(userId, habitId);
    if (!habit) throw new NotFoundException();

    const logCount = await this.habitRepo.countLogs(userId, habitId);
    const daysSinceCreation = (Date.now() - habit.createdAt.getTime()) / 86_400_000;

    if (logCount > 0 && daysSinceCreation > 30) {
      throw new ConflictException({
        code: 'HARD_DELETE_LIMIT',
        message: 'Hard delete is only permitted within 30 days of creation. Use archive instead.',
      });
    }

    await this.dataSource.transaction(async (em) => {
      await em.delete(Habit, { id: habitId, userId });
      await this.emitEvent(em, {
        userId,
        eventType: 'habit.deleted',
        aggregateType: 'habit',
        aggregateId: habitId,
        payload: {},
      });
    });
  }

  // ─── Unarchive (FR-024) ───────────────────────────────────────────────────

  async unarchiveHabit(userId: string, habitId: string): Promise<HabitDto> {
    const habit = await this.habitRepo.findOne(userId, habitId);
    if (!habit) throw new NotFoundException();

    await this.dataSource.transaction(async (em) => {
      await em.query(
        `UPDATE habits SET archived_at = NULL, is_active = true, updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [habitId, userId],
      );
      await this.emitEvent(em, {
        userId,
        eventType: 'habit.unarchived',
        aggregateType: 'habit',
        aggregateId: habitId,
        payload: {},
      });
    });

    const refreshed = await this.habitRepo.findOne(userId, habitId);
    return toHabitDto(refreshed ?? habit);
  }

  // ─── Log habit (FR-030, FR-031) ───────────────────────────────────────────

  async logHabit(
    userId: string,
    habitId: string,
    status: HabitLogStatus,
    logDate: string,
    note: string | null,
    timezone: string,
  ): Promise<{ log: HabitLog; isNew: boolean; currentStreak: number; longestStreak: number }> {
    const habit = await this.habitRepo.findOne(userId, habitId);
    if (!habit) throw new NotFoundException();
    if (habit.archivedAt !== null) {
      throw new ConflictException({ code: 'HABIT_ARCHIVED', message: 'Cannot log an archived habit.' });
    }

    validateLogDate(logDate, timezone);

    interface RawLogRow {
      id: string;
      habit_id: string;
      user_id: string;
      log_date: string;
      status: HabitLogStatus;
      note: string | null;
      logged_at: Date;
      updated_at: Date;
      is_new: boolean;
    }

    let isNew = false;
    let log: HabitLog | undefined;

    await this.dataSource.transaction(async (em) => {
      // upsertLog is inlined here so the INSERT and the event INSERT share the same transaction.
      // Calling habitLogRepo.upsertLog() would use repo.manager (non-transactional) and break atomicity.
      const rows = await em.query<RawLogRow[]>(
        `INSERT INTO habit_logs (habit_id, user_id, log_date, status, note)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (habit_id, log_date) DO UPDATE
           SET status     = EXCLUDED.status,
               note       = EXCLUDED.note,
               updated_at = now()
         RETURNING *, (xmax = 0) AS is_new`,
        [habitId, userId, logDate, status, note],
      );

      const row = rows[0];
      if (!row) throw new Error('Log upsert returned no row');

      isNew = Boolean(row.is_new);
      log = Object.assign(new HabitLog(), {
        id: row.id,
        habitId: row.habit_id,
        userId: row.user_id,
        logDate: row.log_date,
        status: row.status,
        note: row.note,
        loggedAt: row.logged_at,
        updatedAt: row.updated_at,
      });

      const eventType = !isNew
        ? 'habit.log_updated'
        : status === 'completed'
        ? 'habit.completed'
        : 'habit.skipped';

      await em.query(
        `INSERT INTO events (user_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          eventType,
          'habit',
          habitId,
          JSON.stringify({
            status,
            date: logDate,
            habitId,
            noteHash: note ? createHash('sha256').update(note).digest('hex') : null,
            isUpdate: !isNew,
          }),
        ],
      );
    });

    if (!log) throw new Error('Log upsert failed');

    const completedDates = await this.habitLogRepo.findCompletedDates(userId, habitId);
    const today = todayInTimezone(timezone);

    return {
      log,
      isNew,
      currentStreak: computeCurrentStreak(completedDates, today),
      longestStreak: computeLongestStreak(completedDates),
    };
  }

  // ─── Remove log (FR-033) ──────────────────────────────────────────────────

  async removeLog(userId: string, habitId: string, logDate: string, timezone: string): Promise<void> {
    const habit = await this.habitRepo.findOne(userId, habitId);
    if (!habit) throw new NotFoundException();

    validateLogDate(logDate, timezone);

    const existing = await this.habitLogRepo.findByDate(userId, habitId, logDate);
    if (!existing) throw new NotFoundException();

    await this.dataSource.transaction(async (em) => {
      await em.delete(HabitLog, { habitId, userId, logDate });
      await em.query(
        `INSERT INTO events (user_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'habit.log_removed', 'habit', habitId, JSON.stringify({ date: logDate, habitId })],
      );
    });
  }

  // ─── Update log note (FR-034) ─────────────────────────────────────────────

  async updateLogNote(
    userId: string,
    habitId: string,
    logDate: string,
    note: string,
  ): Promise<HabitLog> {
    const habit = await this.habitRepo.findOne(userId, habitId);
    if (!habit) throw new NotFoundException();

    interface RawLogRow {
      id: string;
      habit_id: string;
      user_id: string;
      log_date: string;
      status: HabitLogStatus;
      note: string | null;
      logged_at: Date;
      updated_at: Date;
    }

    let updated: HabitLog | undefined;

    await this.dataSource.transaction(async (em) => {
      // Note update and event emission must be atomic (outbox pattern).
      const rows = await em.query<RawLogRow[]>(
        `UPDATE habit_logs
            SET note = $1, updated_at = now()
          WHERE habit_id = $2 AND user_id = $3 AND log_date = $4
          RETURNING *`,
        [note, habitId, userId, logDate],
      );

      if (!rows[0]) throw new NotFoundException();

      const row = rows[0];
      updated = Object.assign(new HabitLog(), {
        id: row.id,
        habitId: row.habit_id,
        userId: row.user_id,
        logDate: row.log_date,
        status: row.status,
        note: row.note,
        loggedAt: row.logged_at,
        updatedAt: row.updated_at,
      });

      await this.emitEvent(em, {
        userId,
        eventType: 'habit.log_updated',
        aggregateType: 'habit',
        aggregateId: habitId,
        payload: {
          date: logDate,
          habitId,
          noteHash: createHash('sha256').update(note).digest('hex'),
          isUpdate: true,
        },
      });
    });

    if (!updated) throw new Error('updateLogNote transaction did not assign result');
    return updated;
  }

  // ─── Dashboard (FR-040) ───────────────────────────────────────────────────

  async getDashboard(userId: string): Promise<DashboardDto> {
    const timezone = await this.getUserTimezone(userId);
    const today = todayInTimezone(timezone);

    const [habits] = await this.habitRepo.findAll(userId, {
      includeArchived: false,
      limit: 200,
      offset: 0,
    });

    if (habits.length === 0) {
      return {
        summary: {
          activeHabits: 0,
          todayCompleted: 0,
          todaySkipped: 0,
          todayPending: 0,
          overallCompletionRate30d: 0,
          longestStreakAnyHabit: 0,
        },
        habits: [],
        activeRecommendations: [],
      };
    }

    const habitIds = habits.map((h) => h.id);
    const todayLogMap = await this.habitLogRepo.findTodayForHabits(userId, habitIds, today);

    const from30 = subtractDays(today, 29);
    const rateRows = await this.dataSource.query<Array<{ habit_id: string; count: string }>>(
      `SELECT habit_id, COUNT(*)::int AS count
       FROM habit_logs
       WHERE user_id = $1 AND log_date >= $2 AND log_date <= $3 AND status = 'completed'
       GROUP BY habit_id`,
      [userId, from30, today],
    );
    const rateMap = new Map<string, number>(
      rateRows.map((r) => [r.habit_id, parseInt(r.count, 10) / 30]),
    );

    let longestStreakAnyHabit = 0;
    let todayCompleted = 0;
    let todaySkipped = 0;
    let todayPending = 0;

    const habitDtos: DashboardHabitDto[] = [];

    for (const habit of habits) {
      const todayLog = todayLogMap.get(habit.id);
      const todayStatus: 'completed' | 'skipped' | 'pending' =
        todayLog?.status === 'completed'
          ? 'completed'
          : todayLog?.status === 'skipped'
          ? 'skipped'
          : 'pending';

      if (todayStatus === 'completed') todayCompleted++;
      else if (todayStatus === 'skipped') todaySkipped++;
      else todayPending++;

      const completedDates = await this.habitLogRepo.findCompletedDates(userId, habit.id);
      const streak = computeCurrentStreak(completedDates, today);
      const longest = computeLongestStreak(completedDates);
      if (longest > longestStreakAnyHabit) longestStreakAnyHabit = longest;

      habitDtos.push({
        id: habit.id,
        name: habit.name,
        frequencyType: habit.frequencyType,
        preferredTime: habit.preferredTime ? habit.preferredTime.slice(0, 5) : null,
        currentStreak: streak,
        completionRate30d: Math.round((rateMap.get(habit.id) ?? 0) * 100) / 100,
        todayStatus,
      });
    }

    const totalCompleted30d = [...rateMap.values()].reduce((a, b) => a + b * 30, 0);
    const maxPossible = habits.length * 30;
    const overallCompletionRate30d =
      maxPossible > 0 ? Math.round((totalCompleted30d / maxPossible) * 100) / 100 : 0;

    return {
      summary: {
        activeHabits: habits.length,
        todayCompleted,
        todaySkipped,
        todayPending,
        overallCompletionRate30d,
        longestStreakAnyHabit,
      },
      habits: habitDtos,
      activeRecommendations: [],
    };
  }

  // ─── Shared helpers ────────────────────────────────────────────────────────

  async getUserTimezone(userId: string): Promise<string> {
    const rows = await this.dataSource.query<[{ timezone: string }]>(
      `SELECT timezone FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    return rows[0]?.timezone ?? 'UTC';
  }

  private async emitEvent(em: EntityManager, event: EmitEventArgs): Promise<void> {
    await em.query(
      `INSERT INTO events (user_id, event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.userId,
        event.eventType,
        event.aggregateType,
        event.aggregateId ?? null,
        JSON.stringify(event.payload),
      ],
    );
  }
}

// ─── Module-private helpers ───────────────────────────────────────────────────

function toHabitDto(habit: Habit): HabitDto {
  return {
    id: habit.id,
    name: habit.name,
    description: habit.description,
    frequencyType: habit.frequencyType,
    weekdayMask: habit.weekdayMask,
    targetCountPerWeek: habit.targetCountPerWeek,
    preferredTime: habit.preferredTime ? habit.preferredTime.slice(0, 5) : null,
    difficulty: habit.difficulty,
    isActive: habit.isActive,
    archivedAt: habit.archivedAt,
    createdAt: habit.createdAt,
    updatedAt: habit.updatedAt,
  };
}

function buildDiff(before: Habit, dto: UpdateHabitDto): Record<string, unknown> {
  const diff: Record<string, unknown> = {};
  const keys: ReadonlyArray<keyof UpdateHabitDto & keyof Habit> = [
    'name', 'description', 'frequencyType', 'weekdayMask',
    'targetCountPerWeek', 'preferredTime', 'difficulty', 'isActive',
  ];

  for (const key of keys) {
    if (dto[key] !== undefined && dto[key] !== before[key]) {
      diff[key] = { from: before[key], to: dto[key] };
    }
  }

  return diff;
}
