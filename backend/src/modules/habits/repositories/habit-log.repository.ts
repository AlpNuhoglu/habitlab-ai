import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { UserScopedRepository } from '../../../common/repositories/user-scoped.repository';
import type { HabitLogStatus } from '../entities/habit-log.entity';
import { HabitLog } from '../entities/habit-log.entity';

export interface UpsertLogResult {
  log: HabitLog;
  isNew: boolean;
}

@Injectable()
export class HabitLogRepository extends UserScopedRepository<HabitLog> {
  constructor(
    @InjectRepository(HabitLog)
    protected readonly repo: Repository<HabitLog>,
  ) {
    super();
  }

  findByDate(userId: string, habitId: string, logDate: string): Promise<HabitLog | null> {
    return this.repo.findOne({ where: { habitId, userId, logDate } });
  }

  // ON CONFLICT upsert; xmax=0 means the row was freshly inserted
  async upsertLog(
    userId: string,
    habitId: string,
    logDate: string,
    status: HabitLogStatus,
    note: string | null,
  ): Promise<UpsertLogResult> {
    // Raw query returns snake_case column names
    interface RawRow {
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

    const rows = await this.repo.manager.query<RawRow[]>(
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
    if (!row) throw new Error('Upsert returned no row');

    const log = this.repo.create({
      id: row.id,
      habitId: row.habit_id,
      userId: row.user_id,
      logDate: row.log_date,
      status: row.status,
      note: row.note,
      loggedAt: row.logged_at,
      updatedAt: row.updated_at,
    } as HabitLog);

    return { log, isNew: Boolean(row.is_new) };
  }

  async deleteByDate(userId: string, habitId: string, logDate: string): Promise<void> {
    await this.repo.delete({ habitId, userId, logDate });
  }

  async updateNote(
    userId: string,
    habitId: string,
    logDate: string,
    note: string,
  ): Promise<HabitLog | null> {
    const log = await this.findByDate(userId, habitId, logDate);
    if (!log) return null;
    log.note = note;
    return this.repo.save(log);
  }

  // Returns all completed log dates for streak computation (ascending)
  async findCompletedDates(userId: string, habitId: string): Promise<string[]> {
    const rows = await this.repo.manager.query<Array<{ log_date: string }>>(
      `SELECT log_date::text FROM habit_logs
       WHERE habit_id = $1 AND user_id = $2 AND status = 'completed'
       ORDER BY log_date ASC`,
      [habitId, userId],
    );
    return rows.map((r) => r.log_date);
  }

  // Returns logs in the last 30 days for completion rate
  async findLast30Days(userId: string, habitId: string, today: string): Promise<HabitLog[]> {
    return this.repo
      .createQueryBuilder('hl')
      .where('hl.habit_id = :habitId AND hl.user_id = :userId', { habitId, userId })
      .andWhere('hl.log_date >= :from AND hl.log_date <= :today', {
        from: subtractDays(today, 29),
        today,
      })
      .getMany();
  }

  // Returns today's logs for a list of habits (for dashboard)
  async findTodayForHabits(
    userId: string,
    habitIds: string[],
    today: string,
  ): Promise<Map<string, HabitLog>> {
    if (habitIds.length === 0) return new Map();

    const logs = await this.repo
      .createQueryBuilder('hl')
      .where('hl.user_id = :userId', { userId })
      .andWhere('hl.habit_id IN (:...habitIds)', { habitIds })
      .andWhere('hl.log_date = :today', { today })
      .getMany();

    const map = new Map<string, HabitLog>();
    for (const log of logs) {
      map.set(log.habitId, log);
    }
    return map;
  }
}

function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
