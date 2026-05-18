import { useCallback, useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '../../auth/api/use-current-user';
import { useUpdateQuietHours, type QuietHours } from '../api/use-update-quiet-hours';
import { postQuietHoursChanged } from '../lib/push-channel';

export function QuietHoursEditor(): React.ReactElement {
  const { user } = useCurrentUser();
  const updateQuietHours = useUpdateQuietHours();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultHours: QuietHours = user?.preferences.quiet_hours ?? { start: '22:00', end: '07:00' };
  const [start, setStart] = useState(defaultHours.start);
  const [end, setEnd] = useState(defaultHours.end);

  useEffect(() => {
    if (user?.preferences.quiet_hours) {
      setStart(user.preferences.quiet_hours.start);
      setEnd(user.preferences.quiet_hours.end);
    }
  }, [user?.preferences.quiet_hours]);

  const save = useCallback(
    (newHours: QuietHours) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateQuietHours.mutate(newHours, {
          onSuccess: () => postQuietHoursChanged(newHours),
        });
      }, 300);
    },
    [updateQuietHours],
  );

  function handleStart(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value;
    setStart(val);
    save({ start: val, end });
  }

  function handleEnd(e: React.ChangeEvent<HTMLInputElement>): void {
    const val = e.target.value;
    setEnd(val);
    save({ start, end: val });
  }

  const isOvernightWrap = start > end && start !== end;
  const isSame = start === end;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-gray-900">Quiet hours</h3>
        <p className="text-xs text-gray-500">
          No reminders will be sent during this window
          {user?.timezone ? ` (${user.timezone})` : ''}.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">From</span>
          <input
            type="time"
            value={start}
            onChange={handleStart}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <span className="mt-4 text-gray-400">–</span>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">To</span>
          <input
            type="time"
            value={end}
            onChange={handleEnd}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
      </div>

      <p className="text-xs text-gray-400">
        {isSame
          ? 'No quiet hours — reminders may arrive at any time.'
          : isOvernightWrap
          ? `Quiet from ${start} today to ${end} tomorrow (overnight).`
          : `Quiet from ${start} to ${end} daily.`}
      </p>

      {updateQuietHours.isError && (
        <p className="text-xs text-red-600">Failed to save quiet hours. Please try again.</p>
      )}
    </div>
  );
}
