import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useImpressionTracking, _resetSeenForTesting } from './use-impression-tracking';
import * as clientEvent from '../../../lib/events/client-event';

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;

let _lastObserverCallback: IntersectionCallback | null = null;
let observeSpy: ReturnType<typeof vi.fn>;

function setupFakeIntersectionObserver() {
  observeSpy = vi.fn();

  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: IntersectionCallback) {
        _lastObserverCallback = cb;
      }
      observe = observeSpy;
      disconnect = vi.fn();
    },
  );
}

function triggerVisibility(ratio: number) {
  _lastObserverCallback?.([{ intersectionRatio: ratio } as IntersectionObserverEntry]);
}

// Minimal component that attaches useImpressionTracking to a real div
function TestCard({ recId, position = 0 }: { recId: string; position?: number }) {
  const ref = useImpressionTracking(recId, {
    category: 'reschedule',
    source: 'rule',
    position,
  });
  return <div ref={ref} data-testid="card">{recId}</div>;
}

describe('useImpressionTracking', () => {
  beforeEach(() => {
    setupFakeIntersectionObserver();
    _resetSeenForTesting();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('attaches IntersectionObserver to the element on mount', () => {
    render(<TestCard recId="rec-1" />);
    expect(observeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not emit before 200ms dwell', () => {
    const emitSpy = vi.spyOn(clientEvent, 'emitRecommendationShown');
    render(<TestCard recId="rec-no-emit" />);

    triggerVisibility(0.6);
    vi.advanceTimersByTime(100);

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('emits once after 200ms at ≥50% visibility', () => {
    const emitSpy = vi.spyOn(clientEvent, 'emitRecommendationShown');
    render(<TestCard recId="rec-2" position={1} />);

    triggerVisibility(0.6);
    vi.advanceTimersByTime(200);

    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy).toHaveBeenCalledWith('rec-2', 'reschedule', 'rule', 1);
  });

  it('does not emit twice for the same rec (session dedup)', () => {
    const emitSpy = vi.spyOn(clientEvent, 'emitRecommendationShown');

    const { unmount } = render(<TestCard recId="rec-3" />);
    triggerVisibility(0.8);
    vi.advanceTimersByTime(200);
    unmount();

    // Second mount same rec — already in _seen
    render(<TestCard recId="rec-3" />);
    triggerVisibility(0.8);
    vi.advanceTimersByTime(200);

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('cancels timer when visibility drops below threshold', () => {
    const emitSpy = vi.spyOn(clientEvent, 'emitRecommendationShown');
    render(<TestCard recId="rec-4" />);

    triggerVisibility(0.6);
    vi.advanceTimersByTime(100);
    triggerVisibility(0.2); // drops below threshold
    vi.advanceTimersByTime(200);

    expect(emitSpy).not.toHaveBeenCalled();
  });
});
