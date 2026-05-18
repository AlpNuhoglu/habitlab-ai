import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock web-vitals before importing report-vitals
const onINP = vi.fn();
const onLCP = vi.fn();
const onCLS = vi.fn();
const onFCP = vi.fn();
const onTTFB = vi.fn();

vi.mock('web-vitals/attribution', () => ({ onINP, onLCP, onCLS, onFCP, onTTFB }));

const enqueuedEvents: unknown[] = [];
vi.mock('../../events/event-sink', () => ({
  enqueue: (event: unknown) => enqueuedEvents.push(event),
}));

beforeEach(() => {
  enqueuedEvents.splice(0);
  vi.clearAllMocks();
});

describe('reportWebVitals', () => {
  it('registers all 5 metric observers', async () => {
    const { reportWebVitals } = await import('./report-vitals');
    reportWebVitals();
    expect(onINP).toHaveBeenCalledOnce();
    expect(onLCP).toHaveBeenCalledOnce();
    expect(onCLS).toHaveBeenCalledOnce();
    expect(onFCP).toHaveBeenCalledOnce();
    expect(onTTFB).toHaveBeenCalledOnce();
  });

  it('enqueues client.performance event with attribution redaction', async () => {
    const { reportWebVitals } = await import('./report-vitals');
    reportWebVitals();

    const callback = onLCP.mock.calls[0]![0] as (m: unknown) => void;
    callback({
      name: 'LCP',
      value: 1200,
      rating: 'good',
      delta: 1200,
      id: 'v3-abc',
      navigationType: 'navigate',
      attribution: {
        element: 'img',
        textContent: 'sensitive text',
        url: 'https://example.com/path?query=1',
        role: 'img',
      },
    });

    const evt = enqueuedEvents[0] as Record<string, unknown>;
    expect(evt['type']).toBe('client.performance');
    expect(evt['metric']).toBe('LCP');
    expect(evt['value']).toBe(1200);
    expect(evt['rating']).toBe('good');
    // textContent should be stripped
    const attr = evt['attribution'] as Record<string, unknown>;
    expect(attr['textContent']).toBeUndefined();
    // URL should be pathname only
    expect(attr['url']).toBe('/path');
    // other safe fields retained
    expect(attr['element']).toBe('img');
    expect(attr['role']).toBe('img');
  });
});
