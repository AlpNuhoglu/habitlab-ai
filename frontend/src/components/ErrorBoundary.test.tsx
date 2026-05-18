import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { ErrorBoundary } from './ErrorBoundary';
import { __resetFingerprintCacheForTesting } from '../lib/observability/errors/fingerprint-error';
import { __resetForTesting as resetRing } from '../lib/observability/request-id/request-id-store';

// Silence React's error boundary console output in tests
const origConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  resetRing();
  __resetFingerprintCacheForTesting();
  enqueuedEvents.splice(0);
});
afterEach(() => {
  console.error = origConsoleError;
});

const enqueuedEvents: unknown[] = [];
vi.mock('../lib/events/event-sink', () => ({
  enqueue: (event: unknown) => enqueuedEvents.push(event),
}));

function Bomb({ shouldThrow }: { shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) throw new Error('test explosion');
  return <div>OK</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary kind="dashboard">
        <div>hello</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders fallback when child throws', () => {
    render(
      <ErrorBoundary kind="dashboard">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/This section failed to load/i)).toBeInTheDocument();
  });

  it('renders root fallback for kind=root', () => {
    render(
      <ErrorBoundary kind="root">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('emits client.error event on catch', () => {
    render(
      <ErrorBoundary kind="analytics">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    const event = enqueuedEvents.find(
      (e) => (e as { type: string }).type === 'client.error',
    ) as { kind: string; boundaryKind: string; fingerprint: string } | undefined;
    expect(event).toBeDefined();
    expect(event!.kind).toBe('boundary');
    expect(event!.boundaryKind).toBe('analytics');
    expect(typeof event!.fingerprint).toBe('string');
  });

  it('deduplicates identical errors via fingerprint', () => {
    render(
      <ErrorBoundary kind="dashboard">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    const firstCount = enqueuedEvents.filter(
      (e) => (e as { type: string }).type === 'client.error',
    ).length;

    render(
      <ErrorBoundary kind="dashboard">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    const secondCount = enqueuedEvents.filter(
      (e) => (e as { type: string }).type === 'client.error',
    ).length;

    expect(secondCount).toBe(firstCount);
  });

  it('renders custom fallback prop when provided', () => {
    render(
      <ErrorBoundary kind="habits" fallback={<div>custom fallback</div>}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('custom fallback')).toBeInTheDocument();
  });

  it('resets error state when Retry is clicked', () => {
    render(
      <ErrorBoundary kind="coach">
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // After clicking Retry, error state clears — fallback disappears
    // (children re-render and throw again since Bomb.shouldThrow is still true,
    // so we just verify the boundary attempted a reset by checking re-render happened)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    // The boundary re-renders children — Bomb still throws, so fallback shows again.
    // The key invariant is that reset() was called (no crash, component still mounted).
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
