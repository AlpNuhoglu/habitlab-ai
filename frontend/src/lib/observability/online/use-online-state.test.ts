import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOnlineState } from './use-online-state';

beforeEach(() => {
  // Reset to online
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
});

describe('useOnlineState', () => {
  it('returns true when navigator.onLine is true', () => {
    const { result } = renderHook(() => useOnlineState());
    expect(result.current).toBe(true);
  });

  it('reflects offline transition immediately', () => {
    const { result } = renderHook(() => useOnlineState());
    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current).toBe(false);
  });

  it('reflects online transition after going offline', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
    const { result } = renderHook(() => useOnlineState());
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current).toBe(true);
  });
});
