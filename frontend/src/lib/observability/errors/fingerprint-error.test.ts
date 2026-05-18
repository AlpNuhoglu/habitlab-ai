import { describe, it, expect, beforeEach } from 'vitest';
import { fingerprintError, isNewFingerprint, __resetFingerprintCacheForTesting } from './fingerprint-error';
import { scrubError } from './scrub-error';

beforeEach(() => {
  __resetFingerprintCacheForTesting();
});

describe('fingerprintError', () => {
  it('returns a non-empty string', () => {
    const fp = fingerprintError(scrubError(new Error('boom')));
    expect(typeof fp).toBe('string');
    expect(fp.length).toBeGreaterThan(0);
  });

  it('same error → same fingerprint', () => {
    const err = new Error('identical error');
    const fp1 = fingerprintError(scrubError(err));
    const fp2 = fingerprintError(scrubError(err));
    expect(fp1).toBe(fp2);
  });

  it('UUID variation in stack → same fingerprint (UUID is redacted before fingerprinting)', () => {
    const makeErr = (id: string) => {
      const e = new Error('user not found');
      (e as unknown as Record<string, unknown>)['stack'] =
        `Error: user not found\n    at getUser (users.ts:42:1)\n    userId=${id}`;
      return e;
    };
    const fp1 = fingerprintError(scrubError(makeErr('550e8400-e29b-41d4-a716-446655440000')));
    const fp2 = fingerprintError(scrubError(makeErr('00000000-0000-0000-0000-000000000001')));
    expect(fp1).toBe(fp2);
  });

  it('different errors → different fingerprints', () => {
    const fp1 = fingerprintError(scrubError(new Error('error A')));
    const fp2 = fingerprintError(scrubError(new Error('error B')));
    expect(fp1).not.toBe(fp2);
  });

  it('content-hash chunk names are normalized (fingerprint stable across builds)', () => {
    const makeErr = (hash: string) => {
      const e = new Error('render fail');
      (e as unknown as Record<string, unknown>)['stack'] =
        `Error: render fail\n    at Component (assets/index-${hash}.js:1:1)`;
      return e;
    };
    const fp1 = fingerprintError(scrubError(makeErr('a1b2c3d4')));
    const fp2 = fingerprintError(scrubError(makeErr('e5f6a7b8')));
    expect(fp1).toBe(fp2);
  });
});

describe('isNewFingerprint', () => {
  it('returns true for a new fingerprint', () => {
    expect(isNewFingerprint('abc123')).toBe(true);
  });

  it('returns false for a repeated fingerprint', () => {
    isNewFingerprint('abc123');
    expect(isNewFingerprint('abc123')).toBe(false);
  });

  it('returns true again after reset', () => {
    isNewFingerprint('abc123');
    __resetFingerprintCacheForTesting();
    expect(isNewFingerprint('abc123')).toBe(true);
  });
});
