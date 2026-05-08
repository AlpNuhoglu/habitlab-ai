import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { ApiException } from '../../../api/client';
import { useCreateHabit } from '../api/use-create-habit';
import { useUpdateHabit } from '../api/use-update-habit';
import { HabitSchema, type HabitFormValues } from '../schema/habit.schema';
import {
  formValuesToCreateRequest,
  formValuesToUpdateRequest,
  habitToFormDefaults,
} from '../lib/habit-form-mapper';
import { FrequencyPicker } from './FrequencyPicker';
import { WeekdaySelector } from './WeekdaySelector';
import type { Habit } from '../types';

interface HabitFormProps {
  readonly mode: 'create' | 'edit';
  readonly habit?: Habit;
  readonly onSuccess?: () => void;
}

const CREATE_DEFAULTS: HabitFormValues = {
  name: '',
  description: undefined,
  frequencyType: 'daily',
  weekdayMask: undefined,
  preferredTime: undefined,
  difficulty: 3,
};

export function HabitForm({ mode, habit, onSuccess }: HabitFormProps): React.ReactElement {
  const isCustom = habit?.frequencyType === 'custom';
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<HabitFormValues>({
    resolver: zodResolver(HabitSchema),
    defaultValues: mode === 'edit' && habit ? habitToFormDefaults(habit) : CREATE_DEFAULTS,
  });

  const frequencyType = watch('frequencyType');

  useEffect(() => {
    if (mode === 'edit' && habit) reset(habitToFormDefaults(habit));
  }, [habit, mode, reset]);

  function onSubmit(values: HabitFormValues): void {
    if (mode === 'create') {
      createHabit.mutate(formValuesToCreateRequest(values), {
        onSuccess: () => onSuccess?.(),
        onError: (err) => {
          if (err instanceof ApiException && err.error.kind === 'validation') {
            for (const [field, msgs] of Object.entries(err.error.fields)) {
              setError(field as keyof HabitFormValues, { message: msgs[0] ?? 'Invalid' });
            }
          }
        },
      });
    } else if (habit) {
      updateHabit.mutate(
        { id: habit.id, dto: formValuesToUpdateRequest(values) },
        {
          onSuccess: () => onSuccess?.(),
          onError: (err) => {
            if (err instanceof ApiException && err.error.kind === 'validation') {
              for (const [field, msgs] of Object.entries(err.error.fields)) {
                setError(field as keyof HabitFormValues, { message: msgs[0] ?? 'Invalid' });
              }
            }
          },
        },
      );
    }
  }

  const isPending = createHabit.isPending || updateHabit.isPending || isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register('name')}
          autoFocus
          placeholder="e.g. Meditate 10 min"
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          {...register('description')}
          rows={2}
          placeholder="Optional details…"
          className="mt-1 block w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Frequency */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Frequency</label>
        {isCustom ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            This habit uses custom recurrence — configurable in a future release.
          </div>
        ) : (
          <Controller
            name="frequencyType"
            control={control}
            render={({ field }) => (
              <FrequencyPicker
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        )}
      </div>

      {/* Weekday selector (weekly only) */}
      {frequencyType === 'weekly' && !isCustom && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Days</label>
          <Controller
            name="weekdayMask"
            control={control}
            render={({ field }) => (
              <WeekdaySelector
                value={field.value ?? 0}
                onChange={field.onChange}
                {...(errors.weekdayMask?.message ? { error: errors.weekdayMask.message } : {})}
              />
            )}
          />
        </div>
      )}

      {/* Preferred time */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Preferred time</label>
        <input
          {...register('preferredTime')}
          type="time"
          className="mt-1 block w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {errors.preferredTime && (
          <p className="mt-1 text-xs text-red-600">{errors.preferredTime.message}</p>
        )}
      </div>

      {/* Difficulty */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Difficulty</label>
        <Controller
          name="difficulty"
          control={control}
          render={({ field }) => (
            <div className="flex gap-2">
              {([1, 2, 3, 4, 5] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => field.onChange(v)}
                  className={`h-8 w-8 rounded-full text-xs font-semibold transition-colors ${
                    field.value === v
                      ? 'bg-indigo-600 text-white'
                      : 'border border-gray-200 text-gray-500 hover:border-indigo-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        />
        <p className="mt-1 text-xs text-gray-400">1 = easy · 5 = hard</p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : mode === 'create' ? 'Create habit' : 'Save changes'}
      </button>
    </form>
  );
}
