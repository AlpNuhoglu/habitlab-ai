import { describe, it, expect } from 'vitest';
import { isSuspiciousPayload } from './suspicious-payload-check';
import type { Recommendation } from '../types';

function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec-1',
    habitId: 'habit-1',
    category: 'reschedule',
    source: 'rule',
    title: 'Try a different time',
    body: 'Your completion rate improves in the evening.',
    priority: 70,
    status: 'active',
    actionPayload: null,
    experimentVariant: null,
    createdAt: '2025-01-01T00:00:00Z',
    expiresAt: null,
    ...overrides,
  };
}

describe('isSuspiciousPayload', () => {
  it('returns not suspicious for a normal recommendation', () => {
    expect(isSuspiciousPayload(makeRec()).suspicious).toBe(false);
  });

  it('flags body longer than 280 chars as too_long', () => {
    const result = isSuspiciousPayload(makeRec({ body: 'A'.repeat(281) }));
    expect(result.suspicious).toBe(true);
    expect(result.reason).toBe('too_long');
  });

  it('does not flag body of exactly 280 chars', () => {
    expect(isSuspiciousPayload(makeRec({ body: 'A'.repeat(280) })).suspicious).toBe(false);
  });

  it('flags HTML tags in body as unexpected_html', () => {
    const result = isSuspiciousPayload(makeRec({ body: 'Click <a href="#">here</a>' }));
    expect(result.suspicious).toBe(true);
    expect(result.reason).toBe('unexpected_html');
  });

  it('flags HTML tags in title as unexpected_html', () => {
    const result = isSuspiciousPayload(makeRec({ title: '<b>Bold title</b>' }));
    expect(result.suspicious).toBe(true);
    expect(result.reason).toBe('unexpected_html');
  });

  it('flags empty body as empty', () => {
    const result = isSuspiciousPayload(makeRec({ body: '' }));
    expect(result.suspicious).toBe(true);
    expect(result.reason).toBe('empty');
  });

  it('flags empty title as empty', () => {
    const result = isSuspiciousPayload(makeRec({ title: '' }));
    expect(result.suspicious).toBe(true);
    expect(result.reason).toBe('empty');
  });
});
