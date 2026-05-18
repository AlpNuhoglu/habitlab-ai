import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock the flusher so tests are fast and isolated from network
vi.mock('./event-flusher', () => ({
  flushEvents: vi.fn().mockResolvedValue('ok'),
  flushOfflineQueue: vi.fn().mockResolvedValue(undefined),
}));

import { enqueue, flushNow, EventSinkProvider, __resetForTesting } from './event-sink';
import { flushEvents } from './event-flusher';

const mockFlush = flushEvents as ReturnType<typeof vi.fn>;

beforeEach(() => {
  __resetForTesting();
  mockFlush.mockClear();
  mockFlush.mockResolvedValue('ok');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('enqueue — buffer cap', () => {
  it('does not flush before 50 events', () => {
    for (let i = 0; i < 49; i++) {
      enqueue({ type: 'recommendation.impression', recommendationId: `r${i}`, position: i });
    }
    expect(mockFlush).not.toHaveBeenCalled();
  });

  it('flushes immediately when buffer reaches 50 events', async () => {
    for (let i = 0; i < 50; i++) {
      enqueue({ type: 'recommendation.impression', recommendationId: `r${i}`, position: i });
    }
    // flushEvents is async — wait for microtasks to settle
    await Promise.resolve();
    expect(mockFlush).toHaveBeenCalledOnce();
    const [events] = mockFlush.mock.calls[0] as [unknown[]];
    expect(events).toHaveLength(50);
  });

  it('buffer is cleared after flush', async () => {
    for (let i = 0; i < 50; i++) {
      enqueue({ type: 'recommendation.impression', recommendationId: `r${i}`, position: i });
    }
    await Promise.resolve();
    mockFlush.mockClear();
    // Adding one more should NOT trigger another flush (buffer was cleared)
    enqueue({ type: 'client.error', kind: 'global', message: 'oops', stack: null, componentStack: null, fingerprint: 'abc123def456', requestId: null, gitSha: 'test-sha' });
    await Promise.resolve();
    expect(mockFlush).not.toHaveBeenCalled();
  });
});

describe('5-second flush timer', () => {
  it('flushes pending events after 5 seconds', async () => {
    vi.useFakeTimers();
    render(React.createElement(EventSinkProvider, null, null));

    enqueue({ type: 'client.error', kind: 'global', message: 'test', stack: null, componentStack: null, fingerprint: 'abc123def456', requestId: null, gitSha: 'test-sha' });

    await vi.advanceTimersByTimeAsync(5_000);

    expect(mockFlush).toHaveBeenCalledOnce();
  });

  it('does not flush empty buffer on timer tick', async () => {
    vi.useFakeTimers();
    render(React.createElement(EventSinkProvider, null, null));

    await vi.advanceTimersByTimeAsync(5_000);

    expect(mockFlush).not.toHaveBeenCalled();
  });
});

describe('pagehide → sendBeacon', () => {
  it('calls navigator.sendBeacon with buffered events on pagehide', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });

    render(React.createElement(EventSinkProvider, null, null));
    enqueue({ type: 'client.error', kind: 'global', message: 'test', stack: null, componentStack: null, fingerprint: 'abc123def456', requestId: null, gitSha: 'test-sha' });

    window.dispatchEvent(new Event('pagehide'));

    expect(sendBeacon).toHaveBeenCalledOnce();
    const [url, body] = sendBeacon.mock.calls[0] as [string, string];
    expect(url).toBe('/api/v1/events/client');
    expect(JSON.parse(body)).toHaveProperty('events');
  });

  it('does not call sendBeacon when buffer is empty', () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon });

    render(React.createElement(EventSinkProvider, null, null));
    window.dispatchEvent(new Event('pagehide'));

    expect(sendBeacon).not.toHaveBeenCalled();
  });
});

describe('401 response → drop buffer', () => {
  it('drops buffer when flushEvents returns auth', async () => {
    mockFlush.mockResolvedValueOnce('auth');

    // Fill to 50 to trigger flush
    for (let i = 0; i < 50; i++) {
      enqueue({ type: 'recommendation.impression', recommendationId: `r${i}`, position: i });
    }
    await Promise.resolve();
    mockFlush.mockClear();

    // Buffer should be empty after 401 — adding more events and flushing again
    // should send only the new event, not re-send old ones
    enqueue({ type: 'client.error', kind: 'global', message: 'new', stack: null, componentStack: null, fingerprint: 'abc123def456', requestId: null, gitSha: 'test-sha' });
    flushNow();
    await Promise.resolve();

    const [events] = mockFlush.mock.calls[0] as [unknown[]];
    expect(events).toHaveLength(1);
  });
});
