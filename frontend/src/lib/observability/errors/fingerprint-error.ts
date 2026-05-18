import type { ScrubbedError } from './scrub-error';

// djb2 hash — synchronous, deterministic, good enough for grouping
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

// Strip Vite content-hash chunk names (e.g. assets/index-a1b2c3d4.js)
// so the fingerprint is stable across deploys.
const CHUNK_HASH_RE = /assets\/[^-]+-[a-f0-9]{8}\.js/g;

export function fingerprintError(scrubbed: ScrubbedError): string {
  const topFrame = (scrubbed.stack ?? '').split('\n')[1] ?? '';
  const normalized = topFrame.replace(CHUNK_HASH_RE, 'assets/chunk.js');
  const raw = scrubbed.message + normalized;
  return djb2(raw).toString(16).padStart(8, '0').slice(0, 12);
}

// Session-scoped LRU dedup set (max 50 fingerprints).
// isNewFingerprint returns true the first time a fingerprint is seen;
// false for repeats — callers use this to suppress duplicate reports.
const seen = new Set<string>();

export function isNewFingerprint(fp: string): boolean {
  if (seen.has(fp)) return false;
  if (seen.size >= 50) seen.clear();
  seen.add(fp);
  return true;
}

export function __resetFingerprintCacheForTesting(): void {
  seen.clear();
}
