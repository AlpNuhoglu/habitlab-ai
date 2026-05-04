import type { ApiError } from '../../../api/client';

export interface MappedError {
  userMessage: string;
  logPayload: Record<string, unknown>;
}

export function mapApiError(error: ApiError): MappedError {
  switch (error.kind) {
    case 'network':
      return {
        userMessage: 'Network error — check your connection and try again.',
        logPayload: { kind: 'network' },
      };
    case 'unauthorized':
      return {
        userMessage: 'Email or password is incorrect.',
        logPayload: { kind: 'unauthorized' },
      };
    case 'forbidden':
      return {
        userMessage: 'Your email address has not been verified yet.',
        logPayload: { kind: 'forbidden' },
      };
    case 'validation':
      return {
        userMessage: 'Please correct the errors below.',
        logPayload: { kind: 'validation', fieldCount: Object.keys(error.fields).length },
      };
    case 'rate_limited':
      return {
        userMessage: `Too many attempts. Please wait ${error.retryAfterSec} seconds.`,
        logPayload: { kind: 'rate_limited', retryAfterSec: error.retryAfterSec },
      };
    case 'conflict':
      return {
        userMessage: error.message,
        logPayload: { kind: 'conflict' },
      };
    case 'server':
      return {
        userMessage: 'Something went wrong on our end. Please try again.',
        logPayload: { kind: 'server', status: error.status },
      };
  }
}
