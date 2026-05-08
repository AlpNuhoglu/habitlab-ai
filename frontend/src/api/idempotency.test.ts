import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { generateIdempotencyKey, useMutationIdempotency } from './idempotency';

describe('generateIdempotencyKey', () => {
  it('returns a non-empty string', () => {
    expect(generateIdempotencyKey()).toBeTruthy();
  });

  it('returns a different key on each call', () => {
    const a = generateIdempotencyKey();
    const b = generateIdempotencyKey();
    expect(a).not.toBe(b);
  });

  it('branded type: assignable to string', () => {
    const key: string = generateIdempotencyKey();
    expect(typeof key).toBe('string');
  });
});

describe('useMutationIdempotency', () => {
  it('getOrCreateKey returns same key on repeated calls before clear', () => {
    const { result } = renderHook(() => useMutationIdempotency());
    let k1: string, k2: string;
    act(() => { k1 = result.current.getOrCreateKey(); });
    act(() => { k2 = result.current.getOrCreateKey(); });
    expect(k1!).toBe(k2!);
  });

  it('clearKey causes next getOrCreateKey to produce a new key', () => {
    const { result } = renderHook(() => useMutationIdempotency());
    let k1: string, k2: string;
    act(() => { k1 = result.current.getOrCreateKey(); });
    act(() => { result.current.clearKey(); });
    act(() => { k2 = result.current.getOrCreateKey(); });
    expect(k1!).not.toBe(k2!);
  });

  it('each hook instance maintains independent state', () => {
    const { result: a } = renderHook(() => useMutationIdempotency());
    const { result: b } = renderHook(() => useMutationIdempotency());
    let ka: string, kb: string;
    act(() => { ka = a.current.getOrCreateKey(); });
    act(() => { kb = b.current.getOrCreateKey(); });
    expect(ka!).not.toBe(kb!);
  });
});
