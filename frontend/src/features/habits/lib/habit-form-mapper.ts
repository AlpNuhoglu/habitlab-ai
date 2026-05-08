import type { Habit } from '../types';
import type { HabitFormValues } from '../schema/habit.schema';

// Generated DTO types have Record<string,never> for optional string fields — a known
// generated.ts limitation (no @ApiResponse decorators on backend yet). Use plain
// objects and cast through unknown to satisfy the compiler until the spec is updated.

export interface CreateHabitPayload {
  name: string;
  description?: string;
  frequencyType: 'daily' | 'weekly' | 'custom';
  weekdayMask?: number;
  targetCountPerWeek?: number;
  preferredTime?: string;
  difficulty: number;
}

export interface UpdateHabitPayload {
  name?: string;
  description?: string;
  frequencyType?: 'daily' | 'weekly' | 'custom';
  weekdayMask?: number;
  targetCountPerWeek?: number;
  preferredTime?: string;
  difficulty?: number;
  isActive?: boolean;
}

export function formValuesToCreateRequest(values: HabitFormValues): CreateHabitPayload {
  const payload: CreateHabitPayload = {
    name: values.name,
    frequencyType: values.frequencyType,
    difficulty: values.difficulty,
  };
  if (values.description) payload.description = values.description;
  if (values.weekdayMask != null) payload.weekdayMask = values.weekdayMask;
  if (values.preferredTime) payload.preferredTime = values.preferredTime;
  return payload;
}

export function formValuesToUpdateRequest(values: Partial<HabitFormValues>): UpdateHabitPayload {
  const payload: UpdateHabitPayload = {};
  if (values.name !== undefined) payload.name = values.name;
  if (values.description !== undefined && values.description !== null) payload.description = values.description;
  if (values.frequencyType !== undefined) payload.frequencyType = values.frequencyType;
  if (values.weekdayMask != null) payload.weekdayMask = values.weekdayMask;
  if (values.preferredTime) payload.preferredTime = values.preferredTime;
  if (values.difficulty !== undefined) payload.difficulty = values.difficulty;
  return payload;
}

export function habitToFormDefaults(habit: Habit): HabitFormValues {
  const freq = habit.frequencyType === 'custom' ? 'daily' : habit.frequencyType;
  return {
    name: habit.name,
    description: habit.description ?? undefined,
    frequencyType: freq,
    weekdayMask: habit.weekdayMask ?? undefined,
    preferredTime: habit.preferredTime ?? undefined,
    difficulty: habit.difficulty as 1 | 2 | 3 | 4 | 5,
  };
}
