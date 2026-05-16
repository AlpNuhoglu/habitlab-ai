import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { RecommendationCard } from './RecommendationCard';
import type { Recommendation, RecommendationCategory } from '../types';

// Suppress IntersectionObserver noise in jsdom
vi.stubGlobal('IntersectionObserver', class {
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(_cb: unknown) {}
});

vi.mock('../../../lib/events/client-event', () => ({
  emitRecommendationShown: vi.fn(),
  emitRecommendationSuspicious: vi.fn(),
  emitRecommendationAccepted: vi.fn(),
  emitRecommendationDismissed: vi.fn(),
  emitClientExposure: vi.fn(),
  enqueue: vi.fn(),
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec-1',
    habitId: 'habit-1',
    category: 'reschedule',
    source: 'rule',
    title: 'Move your reminder',
    body: 'Your best hour is 18:00.',
    priority: 70,
    status: 'active',
    actionPayload: null,
    experimentVariant: null,
    createdAt: '2025-01-01T00:00:00Z',
    expiresAt: null,
    ...overrides,
  };
}

describe('RecommendationCard', () => {
  it('renders title and body', () => {
    render(<RecommendationCard recommendation={makeRec()} />, { wrapper: makeWrapper() });
    expect(screen.getByText('Move your reminder')).toBeInTheDocument();
    expect(screen.getByText('Your best hour is 18:00.')).toBeInTheDocument();
  });

  it('does NOT show AI insight badge for rule-based recs', () => {
    render(<RecommendationCard recommendation={makeRec({ source: 'rule' })} />, { wrapper: makeWrapper() });
    expect(screen.queryByText('AI insight')).not.toBeInTheDocument();
  });

  it('shows AI insight badge for AI-generated recs', () => {
    render(<RecommendationCard recommendation={makeRec({ source: 'ai' })} />, { wrapper: makeWrapper() });
    expect(screen.getByText('AI insight')).toBeInTheDocument();
  });

  it('calls onAccept with the recommendation when accept button clicked', async () => {
    const onAccept = vi.fn();
    const rec = makeRec();
    render(<RecommendationCard recommendation={rec} onAccept={onAccept} />, { wrapper: makeWrapper() });
    screen.getByText('Move reminder').click();
    expect(onAccept).toHaveBeenCalledWith(rec);
  });

  it('calls onDismiss with the recommendation when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    const rec = makeRec();
    render(<RecommendationCard recommendation={rec} onDismiss={onDismiss} />, { wrapper: makeWrapper() });
    screen.getByText('Not now').click();
    expect(onDismiss).toHaveBeenCalledWith(rec);
  });

  it('disables buttons while pending', () => {
    render(<RecommendationCard recommendation={makeRec()} isAccepting={true} />, { wrapper: makeWrapper() });
    expect(screen.getByRole('button', { name: /Move reminder/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Not now/i })).toBeDisabled();
  });

  const ALL_CATEGORIES: RecommendationCategory[] = [
    'reschedule',
    'reduce_difficulty',
    'streak_celebration',
    'encouragement_after_skip',
    'consistency_reinforcement',
    'retroactive_logging_reminder',
  ];

  it.each(ALL_CATEGORIES)('renders without error for category: %s', (category) => {
    expect(() =>
      render(<RecommendationCard recommendation={makeRec({ category })} />, { wrapper: makeWrapper() }),
    ).not.toThrow();
  });

  it('applies compact layout when compact=true', () => {
    const { container } = render(
      <RecommendationCard recommendation={makeRec()} compact={true} />,
      { wrapper: makeWrapper() },
    );
    expect(container.querySelector('.line-clamp-1')).not.toBeNull();
  });
});
