import { parseISO, format } from 'date-fns';

interface TrackerHeaderProps {
  readonly dates: string[]; // YYYY-MM-DD[]
}

export function TrackerHeader({ dates }: TrackerHeaderProps): React.ReactElement {
  return (
    <div className="flex gap-1 pl-44">
      {dates.map((d) => {
        const parsed = parseISO(d);
        return (
          <div key={d} className="flex w-8 flex-col items-center">
            <span className="text-[10px] font-medium uppercase text-gray-400">
              {format(parsed, 'EEE')[0]}
            </span>
            <span className="text-[10px] text-gray-400">{format(parsed, 'd')}</span>
          </div>
        );
      })}
    </div>
  );
}
