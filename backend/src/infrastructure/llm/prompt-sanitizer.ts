/**
 * Neutralises user-controlled text before it is interpolated into an LLM prompt.
 *
 * Habit names are validated only for length (1–120 chars), so they may contain
 * newlines, quotes and `===` runs. Interpolated raw, that text can close the
 * quoted field it sits in, forge a `=== END PROFILE ===` terminator, or open a
 * new prompt line the model reads as an instruction rather than as data.
 *
 * This is defence in depth, not a guarantee — no escaping fully solves prompt
 * injection. The real containment is architectural: the LLM is given no tools,
 * and its output only ever populates display text (`recommendations.body`,
 * `chat_messages.content`). It can never reach a mutation.
 *
 * Applies to the prompt copy only. The stored habit name and every UI rendering
 * of it are untouched.
 */

/** Matches the 120-char ceiling on `CreateHabitDto.name`, so legitimate names survive intact. */
const MAX_FIELD_LEN = 120;

export function sanitizePromptField(raw: string | null | undefined): string {
  if (!raw) return '';

  const collapsed = raw
    // Newlines and tabs are what let injected text forge a new prompt field.
    .replace(/[\r\n\t]+/g, ' ')
    // Backticks and double quotes close the quoted fields the templates use.
    .replace(/["`]/g, "'")
    // `===` runs would forge the === SECTION === markers that delimit the profile block.
    .replace(/={2,}/g, '=')
    // Stop injected text from introducing new {{placeholder}} tokens.
    .replace(/\{\{|\}\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return collapsed.length > MAX_FIELD_LEN
    ? `${collapsed.slice(0, MAX_FIELD_LEN - 1)}…`
    : collapsed;
}
