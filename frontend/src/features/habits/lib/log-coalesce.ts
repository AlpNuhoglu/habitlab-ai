/**
 * Debounces rapid toggles per (habitId, date) key within a 250ms window.
 * Net-zero cancels (completed → uncompleted → completed in <250ms) send one request.
 * Only the final intent within the window is dispatched.
 */

interface PendingIntent {
  timer: ReturnType<typeof setTimeout>;
  intent: 'log' | 'unlog';
}

const pending = new Map<string, PendingIntent>();
const DEBOUNCE_MS = 250;

export function coalesceToggle(
  habitId: string,
  date: string,
  intent: 'log' | 'unlog',
  dispatch: (intent: 'log' | 'unlog') => void,
): void {
  const key = `${habitId}:${date}`;
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);

  const timer = setTimeout(() => {
    pending.delete(key);
    dispatch(intent);
  }, DEBOUNCE_MS);

  pending.set(key, { timer, intent });
}

/** Cancel any pending toggle for this (habitId, date) without dispatching. */
export function cancelToggle(habitId: string, date: string): void {
  const key = `${habitId}:${date}`;
  const existing = pending.get(key);
  if (existing) {
    clearTimeout(existing.timer);
    pending.delete(key);
  }
}
