import { refreshOnce } from './refresh-mutex';

export type ApiError =
  | { kind: 'network' }
  | { kind: 'unauthorized' }
  | { kind: 'forbidden' }
  | { kind: 'validation'; fields: Record<string, string[]> }
  | { kind: 'rate_limited'; retryAfterSec: number }
  | { kind: 'conflict'; message: string }
  | { kind: 'server'; status: number };

export class ApiException extends Error {
  constructor(public readonly error: ApiError) {
    super(error.kind);
    this.name = 'ApiException';
  }
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function normalizeValidationFields(body: unknown): Record<string, string[]> {
  if (!isRecord(body)) return { _form: ['Validation error'] };
  const msg = body['message'];
  if (isRecord(msg)) {
    const fields: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(msg)) {
      fields[k] = Array.isArray(v) ? (v as unknown[]).map(String) : [String(v)];
    }
    return fields;
  }
  if (Array.isArray(msg)) return { _form: (msg as unknown[]).map(String) };
  if (typeof msg === 'string') return { _form: [msg] };
  return { _form: ['Validation error'] };
}

async function toApiError(res: Response): Promise<ApiError> {
  const { status } = res;
  if (status === 401) return { kind: 'unauthorized' };
  if (status === 403) return { kind: 'forbidden' };
  if (status === 429) {
    const header = res.headers.get('Retry-After');
    return { kind: 'rate_limited', retryAfterSec: header ? parseInt(header, 10) : 60 };
  }
  if (status === 409) {
    const body: unknown = await res.json().catch(() => ({}));
    const msg = isRecord(body) ? body['message'] : undefined;
    const message = typeof msg === 'string' ? msg : 'Conflict';
    return { kind: 'conflict', message };
  }
  if (status === 400 || status === 422) {
    const body: unknown = await res.json().catch(() => ({}));
    return { kind: 'validation', fields: normalizeValidationFields(body) };
  }
  return { kind: 'server', status };
}

export interface ApiFetchOptions {
  skipRefresh?: boolean;
}

async function apiFetchImpl<T>(
  path: string,
  init: RequestInit | undefined,
  isRetry: boolean,
  skipRefresh: boolean,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiException({ kind: 'network' });
  }

  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  if (res.status === 401 && !isRetry && !skipRefresh) {
    await refreshOnce();
    return apiFetchImpl<T>(path, init, true, skipRefresh);
  }

  throw new ApiException(await toApiError(res));
}

export function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options?: ApiFetchOptions,
): Promise<T> {
  return apiFetchImpl<T>(path, init, false, options?.skipRefresh ?? false);
}
