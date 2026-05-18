export interface RequestIdEntry {
  readonly requestId: string;
  readonly route: string;
  readonly ts: number;
}

const MAX_SIZE = 10;
let ring: RequestIdEntry[] = [];
let listeners: Array<() => void> = [];

function notify(): void {
  for (const l of listeners) l();
}

export function captureRequestId(requestId: string, route: string): void {
  ring.push({ requestId, route, ts: Date.now() });
  if (ring.length > MAX_SIZE) ring.shift();
  notify();
}

export function getCurrentRequestId(): string | null {
  return ring[ring.length - 1]?.requestId ?? null;
}

export function getRequestIdForRoute(route: string): string | null {
  for (let i = ring.length - 1; i >= 0; i--) {
    if (ring[i]!.route === route) return ring[i]!.requestId;
  }
  return null;
}

export function getRecentRequestIds(): readonly RequestIdEntry[] {
  return ring;
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function __resetForTesting(): void {
  ring = [];
  listeners = [];
}
