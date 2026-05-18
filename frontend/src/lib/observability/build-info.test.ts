import { describe, it, expect } from 'vitest';
import { BuildInfo } from './build-info';

describe('BuildInfo', () => {
  it('has a non-empty gitSha', () => {
    expect(typeof BuildInfo.gitSha).toBe('string');
    expect(BuildInfo.gitSha.length).toBeGreaterThan(0);
  });

  it('has a valid ISO 8601 buildTime', () => {
    const d = new Date(BuildInfo.buildTime);
    expect(d.toISOString()).toBe(BuildInfo.buildTime);
  });

  it('has a non-empty env', () => {
    expect(typeof BuildInfo.env).toBe('string');
    expect(BuildInfo.env.length).toBeGreaterThan(0);
  });
});
