import { WEEKDAY_LABELS } from '../schema/_frequency';

interface WeekdaySelectorProps {
  readonly value: number; // bit mask, bit 0 = Monday
  readonly onChange: (mask: number) => void;
  readonly error?: string | undefined;
}

export function WeekdaySelector({ value, onChange, error }: WeekdaySelectorProps): React.ReactElement {
  function toggle(bitIndex: number): void {
    onChange(value ^ (1 << bitIndex));
  }

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap">
        {WEEKDAY_LABELS.map((label, i) => {
          const active = ((value >> i) & 1) === 1;
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(i)}
              className={`h-9 w-9 rounded-full text-xs font-semibold transition-colors ${
                active
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {label[0]}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
