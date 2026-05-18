import { describe, it, expect } from 'vitest';
import { scrubError } from './scrub-error';

describe('scrubError', () => {
  it('redacts JWT-shaped tokens from message', () => {
    const err = new Error('token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123');
    const { message } = scrubError(err);
    expect(message).not.toContain('eyJ');
    expect(message).toContain('[JWT]');
  });

  it('redacts email-shaped strings from message', () => {
    const err = new Error('failed for user@example.com');
    const { message } = scrubError(err);
    expect(message).not.toContain('@example.com');
    expect(message).toContain('[EMAIL]');
  });

  it('redacts UUID-shaped strings from stack', () => {
    const err = new Error('oops');
    (err as unknown as Record<string, unknown>)['stack'] =
      'Error: oops\n    at fn (file.ts:1:1)\n    id=550e8400-e29b-41d4-a716-446655440000';
    const { stack } = scrubError(err);
    expect(stack).not.toContain('550e8400');
    expect(stack).toContain('[ID]');
  });

  it('truncates stack to 2000 chars', () => {
    const err = new Error('big');
    (err as unknown as Record<string, unknown>)['stack'] = 'x'.repeat(3000);
    const { stack } = scrubError(err);
    expect(stack!.length).toBeLessThanOrEqual(2000 + 30);
    expect(stack).toContain('[stack truncated]');
  });

  it('truncates componentStack to 20 frames', () => {
    const frames = Array.from({ length: 30 }, (_, i) => `    at Component${i} (file.tsx:${i}:1)`);
    const cs = '\n' + frames.join('\n');
    const { componentStack } = scrubError(new Error('oops'), cs);
    const lines = componentStack!.split('\n').filter(Boolean);
    expect(lines.length).toBeLessThanOrEqual(21);
    expect(componentStack).toContain('[component stack truncated]');
  });

  it('truncates long messages', () => {
    const err = new Error('a'.repeat(600));
    const { message } = scrubError(err);
    expect(message.length).toBeLessThanOrEqual(510 + 11);
    expect(message).toContain('[TRUNCATED]');
  });

  it('handles non-Error raw values gracefully', () => {
    const { message, stack } = scrubError('plain string error');
    expect(message).toBe('plain string error');
    expect(stack).toBeNull();
  });

  it('returns null componentStack when not provided', () => {
    const { componentStack } = scrubError(new Error('x'));
    expect(componentStack).toBeNull();
  });
});
