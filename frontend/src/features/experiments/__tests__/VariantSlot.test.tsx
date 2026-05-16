import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import * as eventSink from '../../../lib/events/event-sink';
import { experimentKeys } from '../../../api/query-keys';
import { VariantSlot } from '../components/VariantSlot';
import { _resetSeenForTesting } from '../lib/exposure-dedup';
import { KNOWN_EXPERIMENT_KEYS } from '../lib/slot-registry';
import { makeAssignmentsMap } from '../testing/fixtures';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

function renderWithQC(ui: React.ReactElement, assignments?: ReturnType<typeof makeAssignmentsMap>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (assignments) {
    qc.setQueryData(experimentKeys.assignments(KNOWN_EXPERIMENT_KEYS), assignments);
  }
  return render(ui, { wrapper: makeWrapper(qc) });
}

describe('<VariantSlot>', () => {
  beforeEach(() => {
    _resetSeenForTesting();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders children (fallback) when no assignments hydrated', () => {
    renderWithQC(
      <VariantSlot id="coach.page.title">Smart Coach</VariantSlot>,
    );
    expect(screen.getByText('Smart Coach')).toBeTruthy();
  });

  it('renders children (fallback) when variant is control', () => {
    renderWithQC(
      <VariantSlot id="coach.page.title">Smart Coach</VariantSlot>,
      makeAssignmentsMap({ rec_copy_v1: 'control' }),
    );
    expect(screen.getByText('Smart Coach')).toBeTruthy();
  });

  it('renders variant content when treatment assigned', () => {
    renderWithQC(
      <VariantSlot id="coach.page.title">Smart Coach</VariantSlot>,
      makeAssignmentsMap({ rec_copy_v1: 'treatment' }),
    );
    expect(screen.getByText('Your Insights')).toBeTruthy();
    expect(screen.queryByText('Smart Coach')).toBeNull();
  });

  it('renders children and emits unknown_variant telemetry for unrecognised variant key', () => {
    const enqueueSpy = vi.spyOn(eventSink, 'enqueue');
    renderWithQC(
      <VariantSlot id="coach.page.title">Smart Coach</VariantSlot>,
      makeAssignmentsMap({ rec_copy_v1: 'unknown_variant_xyz' }),
    );
    expect(screen.getByText('Smart Coach')).toBeTruthy();
    expect(enqueueSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'experiment.unknown_variant',
        experimentKey: 'rec_copy_v1',
        receivedKey: 'unknown_variant_xyz',
      }),
    );
  });

  it('coach.action.accept renders children when control', () => {
    renderWithQC(
      <VariantSlot id="coach.action.accept">Accept</VariantSlot>,
      makeAssignmentsMap({ rec_copy_v1: 'control' }),
    );
    expect(screen.getByText('Accept')).toBeTruthy();
  });

  it('coach.action.accept renders "Try it" when treatment', () => {
    renderWithQC(
      <VariantSlot id="coach.action.accept">Accept</VariantSlot>,
      makeAssignmentsMap({ rec_copy_v1: 'treatment' }),
    );
    expect(screen.getByText('Try it')).toBeTruthy();
  });
});
