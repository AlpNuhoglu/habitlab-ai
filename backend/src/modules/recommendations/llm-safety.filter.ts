// §6.3.3 — Post-generation safety filter.
// Returns the (possibly truncated) text, or null if the text must be discarded.
// Null means the caller falls back to the static template recommendation.

const MEDICAL_KEYWORDS = [
  'diagnose',
  'disorder',
  'prescription',
  'treat',
  'cure',
  'medication',
  'self-harm',
];

const URL_PATTERN = /https?:\/\//i;

const STRUCTURAL_PREFIXES = ['i cannot', 'as an ai', "i'm sorry"];

function truncateAtLastSentence(text: string, maxLen: number): string | null {
  if (text.length <= maxLen) return text;
  const slice = text.slice(0, maxLen);
  // Find last sentence boundary (. ! ?) before the cut
  const match = slice.match(/^(.*[.!?])\s/s);
  if (!match || !match[1]) return null;
  return match[1].trim();
}

export function applySafetyFilter(text: string): string | null {
  // 1. Length check
  let checked = text.trim();
  if (checked.length > 280) {
    const truncated = truncateAtLastSentence(checked, 280);
    if (!truncated) return null;
    checked = truncated;
    // Re-validate length after truncation
    if (checked.length > 280) return null;
  }

  // 2. Keyword check
  const lower = checked.toLowerCase();
  if (MEDICAL_KEYWORDS.some((kw) => lower.includes(kw))) return null;

  // 3. Structural check
  if (STRUCTURAL_PREFIXES.some((prefix) => lower.startsWith(prefix))) return null;
  if (checked.endsWith('?')) return null;
  if (URL_PATTERN.test(checked)) return null;

  return checked;
}
