import type { HabitMutatedMessage } from '../features/recommendations/types';

const CHANNEL_NAME = 'habitlab-auth';

type AuthMessage =
  | { type: 'LOGOUT' }
  | { type: 'LOGIN' }
  | { type: 'SESSION_EXPIRED' };

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME);
  return _channel;
}

export function postLogout(): void {
  getChannel()?.postMessage({ type: 'LOGOUT' } satisfies AuthMessage);
}

export function postLogin(): void {
  getChannel()?.postMessage({ type: 'LOGIN' } satisfies AuthMessage);
}

export function postSessionExpired(): void {
  getChannel()?.postMessage({ type: 'SESSION_EXPIRED' } satisfies AuthMessage);
}

export function onAuthMessage(handler: (msg: AuthMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => undefined;
  const listener = (ev: MessageEvent<AuthMessage>) => handler(ev.data);
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}

// HABIT_MUTATED — owned by the coach feature (features/recommendations/index.ts).
// Broadcast on the same channel so all tabs receive habit state changes triggered
// by recommendation accepts (e.g. reschedule patches preferred_time).

export function postHabitMutated(msg: Omit<HabitMutatedMessage, 'type'>): void {
  getChannel()?.postMessage({ type: 'HABIT_MUTATED', ...msg } satisfies HabitMutatedMessage);
}

export function onHabitMutated(handler: (msg: HabitMutatedMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => undefined;
  const listener = (ev: MessageEvent<unknown>) => {
    const d = ev.data;
    if (
      d !== null &&
      typeof d === 'object' &&
      'type' in d &&
      (d as { type: unknown }).type === 'HABIT_MUTATED'
    ) {
      handler(d as HabitMutatedMessage);
    }
  };
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}
