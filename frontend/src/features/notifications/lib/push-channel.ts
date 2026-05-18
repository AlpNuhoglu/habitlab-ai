import type { QuietHours } from '../api/use-update-quiet-hours';

export type PushBroadcastMessage =
  | { type: 'PERMISSION_CHANGED'; value: NotificationPermission }
  | { type: 'SUBSCRIPTION_CHANGED'; action: 'added' | 'removed' }
  | { type: 'QUIET_HOURS_CHANGED'; quietHours: QuietHours }
  | { type: 'PUSH_RECEIVED'; payload: unknown };

let _channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!_channel) _channel = new BroadcastChannel('habitlab-push');
  return _channel;
}

function post(msg: PushBroadcastMessage): void {
  getChannel()?.postMessage(msg);
}

export function postPermissionChanged(value: NotificationPermission): void {
  post({ type: 'PERMISSION_CHANGED', value });
}

export function postSubscriptionChanged(action: 'added' | 'removed'): void {
  post({ type: 'SUBSCRIPTION_CHANGED', action });
}

export function postQuietHoursChanged(quietHours: QuietHours): void {
  post({ type: 'QUIET_HOURS_CHANGED', quietHours });
}

export function onPushMessage(handler: (msg: PushBroadcastMessage) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => undefined;
  const listener = (e: MessageEvent<PushBroadcastMessage>) => handler(e.data);
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}
