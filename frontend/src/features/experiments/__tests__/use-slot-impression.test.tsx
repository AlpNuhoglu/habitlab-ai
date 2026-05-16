import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

import * as emitEvent from '../../../lib/events/use-emit-event';
import { useSlotImpression } from '../hooks/use-slot-impression';
import { _resetSeenForTesting } from '../lib/exposure-dedup';

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

// Test component for viewport mode
function ViewportSlot({ experimentKey = 'rec_copy_v1' as const }) {
  const ref = useSlotImpression(experimentKey, 'treatment', 'coach.action.accept', 'viewport');
  return <span ref={ref as React.RefObject<HTMLSpanElement>} data-testid="slot">content</span>;
}

// Test component for mount mode
function MountSlot() {
  useSlotImpression('rec_copy_v1', 'treatment', 'coach.page.title', 'mount');
  return <span data-testid="slot">content</span>;
}

describe('useSlotImpression', () => {
  beforeEach(() => {
    _lastObserverCallback = null;
    setupFakeIntersectionObserver();
    _resetSeenForTesting();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('viewport mode', () => {
    it('does not emit before 200ms dwell', () => {
      const spy = vi.spyOn(emitEvent, 'emitClientExposure');
      render(<ViewportSlot />);
      triggerVisibility(0.6);
      vi.advanceTimersByTime(100);
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits after 200ms at ≥50% visibility', () => {
      const spy = vi.spyOn(emitEvent, 'emitClientExposure');
      render(<ViewportSlot />);
      triggerVisibility(0.6);
      vi.advanceTimersByTime(200);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('rec_copy_v1', 'treatment', 'coach.action.accept');
    });

    it('does not emit for control variant', () => {
      const spy = vi.spyOn(emitEvent, 'emitClientExposure');
      function ControlSlot() {
        const ref = useSlotImpression('rec_copy_v1', 'control', 'coach.action.accept', 'viewport');
        return <span ref={ref as React.RefObject<HTMLSpanElement>}>content</span>;
      }
      render(<ControlSlot />);
      triggerVisibility(0.9);
      vi.advanceTimersByTime(200);
      expect(spy).not.toHaveBeenCalled();
    });

    it('dedupes — second mount same key does not re-emit', () => {
      const spy = vi.spyOn(emitEvent, 'emitClientExposure');
      const { unmount } = render(<ViewportSlot />);
      triggerVisibility(0.8);
      vi.advanceTimersByTime(200);
      unmount();

      render(<ViewportSlot />);
      triggerVisibility(0.8);
      vi.advanceTimersByTime(200);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('mount mode', () => {
    it('emits immediately on mount', () => {
      const spy = vi.spyOn(emitEvent, 'emitClientExposure');
      render(<MountSlot />);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('rec_copy_v1', 'treatment', 'coach.page.title');
    });

    it('does not emit for control variant', () => {
      const spy = vi.spyOn(emitEvent, 'emitClientExposure');
      function MountControl() {
        useSlotImpression('rec_copy_v1', 'control', 'coach.page.title', 'mount');
        return <span>content</span>;
      }
      render(<MountControl />);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
