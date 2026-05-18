export interface ScrubbedError {
  message: string;
  stack: string | null;
  componentStack: string | null;
}

const MAX_STACK_CHARS = 2000;
const MAX_COMPONENT_FRAMES = 20;
const MAX_MESSAGE_CHARS = 500;

const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function redact(s: string): string {
  return s
    .replace(JWT_RE, '[JWT]')
    .replace(EMAIL_RE, '[EMAIL]')
    .replace(UUID_RE, '[ID]');
}

function truncateStack(s: string): string {
  if (s.length <= MAX_STACK_CHARS) return s;
  return s.slice(0, MAX_STACK_CHARS) + '\n    [stack truncated]';
}

function truncateComponentStack(s: string): string {
  const lines = s.split('\n');
  if (lines.length <= MAX_COMPONENT_FRAMES) return s;
  return lines.slice(0, MAX_COMPONENT_FRAMES).join('\n') + '\n    [component stack truncated]';
}

function extractMessage(raw: unknown): string {
  if (raw instanceof Error) return raw.message;
  if (typeof raw === 'string') return raw;
  try { return String(raw); } catch { return 'Unknown error'; }
}

function extractStack(raw: unknown): string | null {
  if (raw instanceof Error && typeof raw.stack === 'string') return raw.stack;
  return null;
}

export function scrubError(raw: unknown, componentStack?: string): ScrubbedError {
  let message = extractMessage(raw);
  if (message.length > MAX_MESSAGE_CHARS) {
    message = message.slice(0, MAX_MESSAGE_CHARS) + '[TRUNCATED]';
  }
  message = redact(message);

  const rawStack = extractStack(raw);
  const stack = rawStack !== null ? redact(truncateStack(rawStack)) : null;

  const cs =
    componentStack != null
      ? redact(truncateComponentStack(componentStack))
      : null;

  return { message, stack, componentStack: cs };
}
