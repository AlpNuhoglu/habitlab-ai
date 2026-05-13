import type { DisplayRange, DateRangePickerProps } from '../../types';
import { DISPLAY_RANGE_LABELS } from '../../lib/range-presets';

const PRESETS: DisplayRange[] = ['7d', '30d', '90d', 'all'];

export function DateRangePicker({ value, onChange }: DateRangePickerProps): React.ReactElement {
  return (
    <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1" role="group" aria-label="Time range">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(preset)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            value === preset
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          aria-pressed={value === preset}
        >
          {DISPLAY_RANGE_LABELS[preset]}
        </button>
      ))}
    </div>
  );
}
