import { describe, it, expect } from 'vitest';
import { formValuesToCreateRequest, habitToFormDefaults, type CreateHabitPayload } from './habit-form-mapper';
import type { HabitFormValues } from '../schema/habit.schema';
import type { Habit } from '../types';

const BASE_HABIT: Habit = {
  id: 'h1',
  userId: 'u1',
  name: 'Meditate',
  description: 'Morning session',
  frequencyType: 'daily',
  weekdayMask: null,
  targetCountPerWeek: null,
  preferredTime: '07:00',
  difficulty: 2,
  isActive: true,
  archivedAt: null,
  currentStreak: 5,
  completionRate30d: 0.8,
  todayStatus: 'pending',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
};

describe('habit-form-mapper', () => {
  it('round-trips: habitToFormDefaults → formValuesToCreateRequest produces consistent values', () => {
    const defaults = habitToFormDefaults(BASE_HABIT);
    const request = formValuesToCreateRequest(defaults);

    expect(request.name).toBe(BASE_HABIT.name);
    expect(request.difficulty).toBe(BASE_HABIT.difficulty);
    expect(request.preferredTime).toBe(BASE_HABIT.preferredTime);
    expect(request.frequencyType).toBe(BASE_HABIT.frequencyType);
  });

  it('maps weekly habit with weekday mask correctly', () => {
    const weeklyHabit: Habit = { ...BASE_HABIT, frequencyType: 'weekly', weekdayMask: 0b0000101 };
    const defaults = habitToFormDefaults(weeklyHabit);
    const req: CreateHabitPayload = formValuesToCreateRequest(defaults);
    expect(req.weekdayMask).toBe(0b0000101);
  });

  it('maps custom frequency habit to daily (form does not expose custom)', () => {
    const customHabit: Habit = { ...BASE_HABIT, frequencyType: 'custom', targetCountPerWeek: 4 };
    const defaults = habitToFormDefaults(customHabit);
    expect(defaults.frequencyType).toBe('daily');
  });

  it('null description maps to undefined in request', () => {
    const habit: Habit = { ...BASE_HABIT, description: null };
    const defaults = habitToFormDefaults(habit);
    const req = formValuesToCreateRequest(defaults as HabitFormValues);
    expect(req.description).toBeUndefined();
  });
});
