import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

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
}));

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
    render(<RecommendationCard recommendation={makeRec()} />);
    expect(screen.getByText('Move your reminder')).toBeInTheDocument();
    expect(screen.getByText('Your best hour is 18:00.')).toBeInTheDocument();
  });

  it('does NOT show AI insight badge for rule-based recs', () => {
    render(<RecommendationCard recommendation={makeRec({ source: 'rule' })} />);
    expect(screen.queryByText('AI insight')).not.toBeInTheDocument();
  });

  it('shows AI insight badge for AI-generated recs', () => {
    render(<RecommendationCard recommendation={makeRec({ source: 'ai' })} />);
    expect(screen.getByText('AI insight')).toBeInTheDocument();
  });

  it('calls onAccept with the recommendation when accept button clicked', async () => {
    const onAccept = vi.fn();
    const rec = makeRec();
    render(<RecommendationCard recommendation={rec} onAccept={onAccept} />);
    screen.getByText('Move reminder').click();
    expect(onAccept).toHaveBeenCalledWith(rec);
  });

  it('calls onDismiss with the recommendation when dismiss button clicked', () => {
    const onDismiss = vi.fn();
    const rec = makeRec();
    render(<RecommendationCard recommendation={rec} onDismiss={onDismiss} />);
    screen.getByText('Not now').click();
    expect(onDismiss).toHaveBeenCalledWith(rec);
  });

  it('disables buttons while pending', () => {
    render(<RecommendationCard recommendation={makeRec()} isAccepting={true} />);
    expect(screen.getByText('Move reminder')).toBeDisabled();
    expect(screen.getByText('Not now')).toBeDisabled();
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
      render(<RecommendationCard recommendation={makeRec({ category })} />),
    ).not.toThrow();
  });

  it('applies compact layout when compact=true', () => {
    const { container } = render(
      <RecommendationCard recommendation={makeRec()} compact={true} />,
    );
    // line-clamp-1 applied to title in compact mode
    expect(container.querySelector('.line-clamp-1')).not.toBeNull();
  });
});
