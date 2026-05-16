import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import * as emitEvent from '../../../lib/events/use-emit-event';
import { useExposure } from '../hooks/use-exposure';
import { _resetSeenForTesting } from '../lib/exposure-dedup';

describe('useExposure', () => {
  beforeEach(() => {
    _resetSeenForTesting();
  });

  it('does not emit for control variant', () => {
    const spy = vi.spyOn(emitEvent, 'emitClientExposure');
    renderHook(() => useExposure('rec_copy_v1', 'control', 'coach.page.title'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('emits once for non-control variant', () => {
    const spy = vi.spyOn(emitEvent, 'emitClientExposure');
    renderHook(() => useExposure('rec_copy_v1', 'treatment', 'coach.page.title'));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('rec_copy_v1', 'treatment', 'coach.page.title');
  });

  it('does not emit twice for the same experimentKey (session dedup)', () => {
    const spy = vi.spyOn(emitEvent, 'emitClientExposure');
    renderHook(() => useExposure('rec_copy_v1', 'treatment', 'coach.page.title'));
    renderHook(() => useExposure('rec_copy_v1', 'treatment', 'coach.action.accept'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits independently for different experimentKeys', () => {
    const spy = vi.spyOn(emitEvent, 'emitClientExposure');
    renderHook(() => useExposure('rec_copy_v1', 'treatment', 'coach.page.title'));
    renderHook(() => useExposure('notification_copy_v1', 'motivated', 'notification.copy'));
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
