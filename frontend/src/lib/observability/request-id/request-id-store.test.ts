import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  captureRequestId,
  getCurrentRequestId,
  getRequestIdForRoute,
  getRecentRequestIds,
  subscribe,
  __resetForTesting,
} from './request-id-store';

beforeEach(() => {
  __resetForTesting();
});

describe('request-id-store', () => {
  it('returns null when ring is empty', () => {
    expect(getCurrentRequestId()).toBeNull();
  });

  it('returns the most recent requestId', () => {
    captureRequestId('aaa', '/api/v1/dashboard');
    captureRequestId('bbb', '/api/v1/habits');
    expect(getCurrentRequestId()).toBe('bbb');
  });

  it('looks up the most recent id for a given route', () => {
    captureRequestId('aaa', '/api/v1/dashboard');
    captureRequestId('bbb', '/api/v1/habits');
    captureRequestId('ccc', '/api/v1/dashboard');
    expect(getRequestIdForRoute('/api/v1/dashboard')).toBe('ccc');
    expect(getRequestIdForRoute('/api/v1/habits')).toBe('bbb');
    expect(getRequestIdForRoute('/api/v1/unknown')).toBeNull();
  });

  it('evicts oldest entry when ring exceeds max size (10)', () => {
    for (let i = 0; i < 12; i++) {
      captureRequestId(`id-${i}`, `/route/${i}`);
    }
    const recent = getRecentRequestIds();
    expect(recent).toHaveLength(10);
    expect(recent[0]!.requestId).toBe('id-2');
    expect(recent[9]!.requestId).toBe('id-11');
  });

  it('notifies subscribers on capture', () => {
    const listener = vi.fn();
    const unsub = subscribe(listener);
    captureRequestId('aaa', '/api/v1/test');
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    captureRequestId('bbb', '/api/v1/test');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
