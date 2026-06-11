import type { DisplayRange, DateRangePickerProps } from '../../types';
import { DISPLAY_RANGE_LABELS } from '../../lib/range-presets';

const PRESETS: DisplayRange[] = ['7d', '30d', '90d', 'all'];

export function DateRangePicker({ value, onChange }: DateRangePickerProps): React.ReactElement {
  return (
    <div className="flex gap-1 rounded-lg border border-gray-800 bg-gray-950/60 p-1" role="group" aria-label="Time range">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(preset)}
          className={`rounded-md px-3 py-1 text-xs font-medium tracking-wider uppercase transition-all ${
            value === preset
              ? 'border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
              : 'text-gray-600 hover:text-gray-400'
          }`}
          aria-pressed={value === preset}
        >
          {DISPLAY_RANGE_LABELS[preset]}
        </button>
      ))}
    </div>
  );
}
