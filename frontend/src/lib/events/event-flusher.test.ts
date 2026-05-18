import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./offline-queue', () => ({
  enqueueOffline: vi.fn().mockResolvedValue(undefined),
  drainOffline: vi.fn().mockResolvedValue([]),
}));

import { enqueueOffline } from './offline-queue';

const mockEnqueueOffline = enqueueOffline as ReturnType<typeof vi.fn>;

const ENVELOPE = {
  clientEventId: 'test-id',
  occurredAt: new Date().toISOString(),
  event: {
    type: 'client.error' as const,
    kind: 'global' as const,
    message: 'test',
    stack: null,
    componentStack: null,
    fingerprint: 'abc123def456',
    requestId: null,
    gitSha: 'test-sha',
  },
};

beforeEach(() => {
  mockEnqueueOffline.mockClear();
  vi.stubGlobal('navigator', { ...navigator, onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('flushEvents — telemetry disabled (default)', () => {
  it('returns ok without calling fetch when VITE_ENABLE_TELEMETRY is not set', async () => {
    // Default env has telemetry disabled — module-level ENABLED=false
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Use resetModules to get a fresh module with default (disabled) env
    vi.resetModules();
    const { flushEvents } = await import('./event-flusher');
    const result = await flushEvents([ENVELOPE]);

    expect(result).toBe('ok');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('flushEvents — telemetry enabled', () => {
  async function getEnabledFlusher() {
    vi.stubEnv('VITE_ENABLE_TELEMETRY', 'true');
    vi.resetModules();
    return import('./event-flusher');
  }

  it('calls fetch with correct endpoint', async () => {
    const { flushEvents } = await getEnabledFlusher();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const result = await flushEvents([ENVELOPE]);

    expect(result).toBe('ok');
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/events/client',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns auth on 401 without retrying', async () => {
    const { flushEvents } = await getEnabledFlusher();
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await flushEvents([ENVELOPE]);

    expect(result).toBe('auth');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('silently returns ok on 404', async () => {
    const { flushEvents } = await getEnabledFlusher();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const result = await flushEvents([ENVELOPE]);

    expect(result).toBe('ok');
  });

  it('falls back to IDB on network failure', async () => {
    const { flushEvents } = await getEnabledFlusher();
    vi.stubGlobal('navigator', { onLine: false });

    const result = await flushEvents([ENVELOPE]);

    expect(result).toBe('offline');
    expect(mockEnqueueOffline).toHaveBeenCalledWith([ENVELOPE]);
  });

  it('returns ok immediately for empty batch', async () => {
    const { flushEvents } = await getEnabledFlusher();
    const result = await flushEvents([]);
    expect(result).toBe('ok');
  });
});
