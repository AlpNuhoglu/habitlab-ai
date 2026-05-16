import { describe, it, expect, beforeEach } from 'vitest';

import {
  clearExposures,
  hasSeenExposure,
  markExposureSeen,
  _resetSeenForTesting,
} from '../lib/exposure-dedup';

describe('exposure-dedup', () => {
  beforeEach(() => {
    _resetSeenForTesting();
  });

  it('returns false before marking', () => {
    expect(hasSeenExposure('rec_copy_v1')).toBe(false);
  });

  it('returns true after marking', () => {
    markExposureSeen('rec_copy_v1');
    expect(hasSeenExposure('rec_copy_v1')).toBe(true);
  });

  it('does not affect other keys', () => {
    markExposureSeen('rec_copy_v1');
    expect(hasSeenExposure('notification_copy_v1')).toBe(false);
  });

  it('clearExposures resets all keys', () => {
    markExposureSeen('rec_copy_v1');
    markExposureSeen('notification_copy_v1');
    clearExposures();
    expect(hasSeenExposure('rec_copy_v1')).toBe(false);
    expect(hasSeenExposure('notification_copy_v1')).toBe(false);
  });
});
