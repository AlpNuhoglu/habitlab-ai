import type { ClientEventBatch, ClientEventEnvelope } from './client-event';
import { enqueueOffline } from './offline-queue';

const ENDPOINT = '/api/v1/events/client';
const MAX_RETRIES = 3;
const ENABLED = import.meta.env.VITE_ENABLE_TELEMETRY === 'true';

type FlushResult = 'ok' | 'offline' | 'auth' | 'error';

async function postBatch(events: ClientEventEnvelope[]): Promise<FlushResult> {
  if (!navigator.onLine) return 'offline';

  const body: ClientEventBatch = { events };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1))); // 1s, 2s, 4s
    }
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) return 'ok';
      if (res.status === 401) return 'auth';
      if (res.status === 404) {
        if (import.meta.env.DEV) console.warn('[event-sink] POST /events/client → 404 (endpoint not yet live)');
        return 'ok'; // silent fail — endpoint pending backend implementation
      }
      // 5xx: retry
    } catch {
      if (!navigator.onLine) return 'offline';
      // network error: retry
    }
  }
  return 'error';
}

export async function flushEvents(events: ClientEventEnvelope[]): Promise<FlushResult> {
  if (events.length === 0) return 'ok';

  if (!ENABLED) {
    if (import.meta.env.DEV) {
      console.log('[event-sink] would POST', events);
    }
    return 'ok';
  }

  const result = await postBatch(events);
  if (result === 'offline' || result === 'error') {
    await enqueueOffline(events);
  }
  return result;
}

export async function flushOfflineQueue(): Promise<void> {
  if (!ENABLED || !navigator.onLine) return;
  const { drainOffline } = await import('./offline-queue');
  const batches = await drainOffline();
  for (const batch of batches) {
    await postBatch(batch);
  }
}
