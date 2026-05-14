import type { Recommendation } from '../types';

interface SuspiciousResult {
  readonly suspicious: boolean;
  readonly reason?: 'too_long' | 'unexpected_html' | 'empty';
}

const HTML_TAG_RE = /<[a-z][\s\S]*>/i;

export function isSuspiciousPayload(rec: Recommendation): SuspiciousResult {
  if (!rec.body || !rec.title) return { suspicious: true, reason: 'empty' };
  if (rec.body.length > 280) return { suspicious: true, reason: 'too_long' };
  if (HTML_TAG_RE.test(rec.body) || HTML_TAG_RE.test(rec.title)) {
    return { suspicious: true, reason: 'unexpected_html' };
  }
  return { suspicious: false };
}
