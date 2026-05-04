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
