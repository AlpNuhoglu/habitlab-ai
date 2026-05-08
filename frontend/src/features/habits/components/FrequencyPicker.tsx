import type { HabitFormValues } from '../schema/habit.schema';

interface FrequencyPickerProps {
  readonly value: HabitFormValues['frequencyType'];
  readonly onChange: (v: 'daily' | 'weekly') => void;
  readonly disabled?: boolean;
}

export function FrequencyPicker({ value, onChange, disabled }: FrequencyPickerProps): React.ReactElement {
  return (
    <div className="flex gap-3">
      {(['daily', 'weekly'] as const).map((freq) => (
        <label
          key={freq}
          className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            value === freq
              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
              : 'border-gray-200 text-gray-600 hover:border-gray-300'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <input
            type="radio"
            name="frequencyType"
            value={freq}
            checked={value === freq}
            onChange={() => !disabled && onChange(freq)}
            disabled={disabled}
            className="sr-only"
          />
          {freq === 'daily' ? 'Every day' : 'Weekly'}
        </label>
      ))}
    </div>
  );
}
