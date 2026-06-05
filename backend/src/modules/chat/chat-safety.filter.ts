// Same keyword/structural logic as recommendations/llm-safety.filter.ts but with a
// higher char limit suited for chat responses (1000 chars vs 280 for rec cards).

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
  const match = slice.match(/^(.*[.!?])\s/s);
  if (!match || !match[1]) return null;
  return match[1].trim();
}

export function applyCoachSafetyFilter(text: string): string | null {
  const MAX_LEN = 1000;

  let checked = text.trim();
  if (checked.length > MAX_LEN) {
    const truncated = truncateAtLastSentence(checked, MAX_LEN);
    if (!truncated) return null;
    checked = truncated;
    if (checked.length > MAX_LEN) return null;
  }

  const lower = checked.toLowerCase();
  if (MEDICAL_KEYWORDS.some((kw) => lower.includes(kw))) return null;
  if (STRUCTURAL_PREFIXES.some((prefix) => lower.startsWith(prefix))) return null;
  // Note: unlike recommendation cards (§6.3.3), chat responses may end with a question —
  // coaches naturally ask follow-up questions, so the endsWith('?') ban is omitted here.
  if (URL_PATTERN.test(checked)) return null;

  return checked;
}
