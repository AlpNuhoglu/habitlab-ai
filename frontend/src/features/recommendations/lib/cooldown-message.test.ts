import { describe, it, expect } from 'vitest';
import { cooldownMessage } from './cooldown-message';

describe('cooldownMessage', () => {
  it('includes the habit name', () => {
    expect(cooldownMessage('Run')).toContain('Run');
  });

  it('mentions 14 days', () => {
    expect(cooldownMessage('Run')).toContain('14 days');
  });

  it('produces the exact copy template', () => {
    expect(cooldownMessage('Run')).toBe(
      "Dismissed — we'll hold this suggestion for Run for the next 14 days.",
    );
  });

  it('works with habit names containing spaces', () => {
    const msg = cooldownMessage('Morning Yoga');
    expect(msg).toContain('Morning Yoga');
  });
});
