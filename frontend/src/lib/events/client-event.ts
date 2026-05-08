// client.performance is in the union for type completeness but has no emitPerformance
// helper — web-vitals integration is deferred. Add the helper when that lands.
export type ClientEvent =
  | { type: 'recommendation.impression'; recommendationId: string; position: number }
  | { type: 'experiment.exposure'; experimentKey: string; variantKey: string; feature: string }
  | { type: 'client.error'; errorCode: string; message: string; route: string }
  | { type: 'client.performance'; metric: string; value: number };

export interface ClientEventEnvelope {
  readonly clientEventId: string;
  readonly occurredAt: string;
  readonly event: ClientEvent;
}

export interface ClientEventBatch {
  readonly events: readonly ClientEventEnvelope[];
}

// Import is safe despite circular module reference: by the time these helpers are
// *called* (at runtime from components), event-sink.ts is fully initialized.
// ES live bindings resolve the reference correctly.
import { enqueue } from './event-sink';

export function emitImpression(recommendationId: string, position: number): void {
  enqueue({ type: 'recommendation.impression', recommendationId, position });
}

export function emitExposure(
  experimentKey: string,
  variantKey: string,
  feature: string,
): void {
  enqueue({ type: 'experiment.exposure', experimentKey, variantKey, feature });
}

export function emitClientError(errorCode: string, message: string): void {
  enqueue({
    type: 'client.error',
    errorCode,
    message,
    route: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}
