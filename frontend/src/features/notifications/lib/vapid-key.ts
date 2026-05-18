export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);
  const raw = atob(padded + padding);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

export function getVapidPublicKey(): Uint8Array {
  const key = import.meta.env['VITE_VAPID_PUBLIC_KEY'] as string | undefined;
  if (!key) {
    throw new Error('VITE_VAPID_PUBLIC_KEY is not set. Add it to .env.local before enabling push.');
  }
  return urlBase64ToUint8Array(key);
}
