import { useEffect } from 'react';

import type { ClientEvent, ClientEventEnvelope } from './client-event';
import { flushEvents, flushOfflineQueue } from './event-flusher';

const MAX_BUFFER = 50;
const FLUSH_INTERVAL_MS = 5_000;

let buffer: ClientEventEnvelope[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function buildEnvelope(event: ClientEvent): ClientEventEnvelope {
  return {
    clientEventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    event,
  };
}

async function doFlush(): Promise<void> {
  if (buffer.length === 0) return;
  const batch = buffer;
  buffer = [];
  const result = await flushEvents(batch);
  if (result === 'auth') {
    // Post-logout events belong to the old session — drop, do not retry
    buffer = [];
  }
}

export function enqueue(event: ClientEvent): void {
  buffer.push(buildEnvelope(event));
  if (buffer.length >= MAX_BUFFER) {
    void doFlush();
  }
}

export function flushNow(): void {
  void doFlush();
}

function startTimer(): void {
  if (flushTimer !== null) return;
  flushTimer = setInterval(() => void doFlush(), FLUSH_INTERVAL_MS);
}

function stopTimer(): void {
  if (flushTimer !== null) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

// EventSinkProvider manages the flush timer and pagehide listener lifecycle.
// Correction #2: pagehide fires before component unmount — window listener is the
// correct registration site, not a cleanup callback tied to unmount timing.
// Resets module-level state between tests — not part of the public API.
export function __resetForTesting(): void {
  buffer = [];
  stopTimer();
}

export function EventSinkProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  useEffect(() => {
    startTimer();
    void flushOfflineQueue();
    return stopTimer;
  }, []);

  useEffect(() => {
    const handler = (): void => {
      if (buffer.length === 0) return;
      // sendBeacon is fire-and-forget and survives page unload
      const payload = JSON.stringify({ events: buffer.map((e) => e) });
      const sent = navigator.sendBeacon?.('/api/v1/events/client', payload);
      if (!sent) {
        // sendBeacon failed (quota exceeded) — nothing more we can do at this point
      }
      buffer = [];
    };
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, []);

  useEffect(() => {
    const handler = (): void => void flushOfflineQueue();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, []);

  return children as React.ReactElement;
}
