import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { IsNull, Not } from 'typeorm';

import { UserScopedRepository } from '../../../common/repositories/user-scoped.repository';
import type { HabitFrequencyType } from '../entities/habit.entity';
import { Habit } from '../entities/habit.entity';

export interface CreateHabitData {
  userId: string;
  name: string;
  description?: string | null;
  frequencyType: HabitFrequencyType;
  weekdayMask?: number | null;
  targetCountPerWeek?: number | null;
  preferredTime?: string | null;
  difficulty: number;
}

export interface UpdateHabitData {
  name?: string;
  description?: string | null;
  frequencyType?: HabitFrequencyType;
  weekdayMask?: number | null;
  targetCountPerWeek?: number | null;
  preferredTime?: string | null;
  difficulty?: number;
  isActive?: boolean;
}

export interface ListHabitsOptions {
  includeArchived?: boolean;
  limit: number;
  offset: number;
}

@Injectable()
export class HabitRepository extends UserScopedRepository<Habit> {
  constructor(
    @InjectRepository(Habit)
    protected readonly repo: Repository<Habit>,
  ) {
    super();
  }

  findAll(userId: string, opts: ListHabitsOptions): Promise<[Habit[], number]> {
    const qb = this.repo
      .createQueryBuilder('h')
      .where('h.user_id = :userId', { userId })
      .orderBy('h.created_at', 'DESC')
      .take(opts.limit)
      .skip(opts.offset);

    if (!opts.includeArchived) {
      qb.andWhere('h.archived_at IS NULL');
    }

    return qb.getManyAndCount();
  }

  findOne(userId: string, habitId: string): Promise<Habit | null> {
    return this.repo.findOne({ where: { id: habitId, userId } });
  }

  create(data: CreateHabitData): Promise<Habit> {
    const habit = this.repo.create({
      userId: data.userId,
      name: data.name,
      description: data.description ?? null,
      frequencyType: data.frequencyType,
      weekdayMask: data.weekdayMask ?? null,
      targetCountPerWeek: data.targetCountPerWeek ?? null,
      preferredTime: data.preferredTime ?? null,
      difficulty: data.difficulty,
    });
    return this.repo.save(habit);
  }

  async update(userId: string, habitId: string, data: UpdateHabitData): Promise<Habit | null> {
    const habit = await this.findOne(userId, habitId);
    if (!habit) return null;

    if (data.name !== undefined) habit.name = data.name;
    if (data.description !== undefined) habit.description = data.description;
    if (data.frequencyType !== undefined) habit.frequencyType = data.frequencyType;
    if (data.weekdayMask !== undefined) habit.weekdayMask = data.weekdayMask;
    if (data.targetCountPerWeek !== undefined) habit.targetCountPerWeek = data.targetCountPerWeek;
    if (data.preferredTime !== undefined) habit.preferredTime = data.preferredTime;
    if (data.difficulty !== undefined) habit.difficulty = data.difficulty;
    if (data.isActive !== undefined) habit.isActive = data.isActive;

    return this.repo.save(habit);
  }

  async archive(userId: string, habitId: string): Promise<void> {
    await this.repo.update(
      { id: habitId, userId },
      { archivedAt: new Date(), isActive: false },
    );
  }

  async unarchive(userId: string, habitId: string): Promise<void> {
    await this.repo.manager.query(
      `UPDATE habits SET archived_at = NULL, is_active = true, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [habitId, userId],
    );
  }

  async hardDelete(userId: string, habitId: string): Promise<void> {
    await this.repo.delete({ id: habitId, userId });
  }

  // Returns count of logs for this habit (used for FR-025 hard-delete gate)
  async countLogs(userId: string, habitId: string): Promise<number> {
    const result = await this.repo.manager.query<[{ count: string }]>(
      `SELECT COUNT(*)::int AS count FROM habit_logs WHERE habit_id = $1 AND user_id = $2`,
      [habitId, userId],
    );
    return parseInt(result[0]?.count ?? '0', 10);
  }

  findAllArchived(userId: string): Promise<Habit[]> {
    return this.repo.find({ where: { userId, archivedAt: Not(IsNull()) } });
  }
}
