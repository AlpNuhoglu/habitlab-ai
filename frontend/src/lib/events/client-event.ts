// client.performance is in the union for type completeness but has no emitPerformance
// helper — web-vitals integration is deferred. Add the helper when that lands.

import type { RecommendationCategory, RecommendationSource } from '../../features/recommendations/types';

export type ClientEvent =
  | { type: 'recommendation.impression'; recommendationId: string; position: number }
  | { type: 'recommendation.shown'; recommendationId: string; category: RecommendationCategory; source: RecommendationSource; position: number }
  | { type: 'recommendation.accepted_client'; recommendationId: string; category: RecommendationCategory; source: RecommendationSource }
  | { type: 'recommendation.dismissed_client'; recommendationId: string; category: RecommendationCategory; source: RecommendationSource }
  | { type: 'recommendation.suspicious'; recommendationId: string; reason: 'too_long' | 'unexpected_html' | 'empty' }
  | { type: 'experiment.exposure'; experimentKey: string; variantKey: string; feature: string }
  | { type: 'experiment.client_exposure'; experimentKey: string; variantKey: string; feature: string }
  | { type: 'experiments.hydration_failed'; reason: string }
  | { type: 'experiment.unknown_variant'; experimentKey: string; receivedKey: string }
  | { type: 'experiment.opt_out_toggled'; optedOut: boolean }
  | { type: 'client.error'; errorCode: string; message: string; route: string }
  | { type: 'client.performance'; metric: string; value: number }
  | { type: 'push.permission_granted' }
  | { type: 'push.permission_denied' }
  | { type: 'push.subscribed'; deviceId: string }
  | { type: 'push.unsubscribed'; deviceId: string }
  | { type: 'push.opened'; notificationId?: string | undefined; habitId?: string | undefined }
  | { type: 'push.install_prompt_shown' }
  | { type: 'push.install_prompt_accepted' }
  | { type: 'push.install_prompt_dismissed' };

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

export function emitRecommendationShown(
  recommendationId: string,
  category: RecommendationCategory,
  source: RecommendationSource,
  position: number,
): void {
  enqueue({ type: 'recommendation.shown', recommendationId, category, source, position });
}

export function emitRecommendationAccepted(
  recommendationId: string,
  category: RecommendationCategory,
  source: RecommendationSource,
): void {
  enqueue({ type: 'recommendation.accepted_client', recommendationId, category, source });
}

export function emitRecommendationDismissed(
  recommendationId: string,
  category: RecommendationCategory,
  source: RecommendationSource,
): void {
  enqueue({ type: 'recommendation.dismissed_client', recommendationId, category, source });
}

export function emitRecommendationSuspicious(
  recommendationId: string,
  reason: 'too_long' | 'unexpected_html' | 'empty',
): void {
  enqueue({ type: 'recommendation.suspicious', recommendationId, reason });
}

export function emitExposure(
  experimentKey: string,
  variantKey: string,
  feature: string,
): void {
  enqueue({ type: 'experiment.exposure', experimentKey, variantKey, feature });
}

export function emitClientExposure(
  experimentKey: string,
  variantKey: string,
  feature: string,
): void {
  enqueue({ type: 'experiment.client_exposure', experimentKey, variantKey, feature });
}

export function emitClientError(errorCode: string, message: string): void {
  enqueue({
    type: 'client.error',
    errorCode,
    message,
    route: typeof window !== 'undefined' ? window.location.pathname : '',
  });
}

export function emitPushPermissionGranted(): void {
  enqueue({ type: 'push.permission_granted' });
}

export function emitPushPermissionDenied(): void {
  enqueue({ type: 'push.permission_denied' });
}

export function emitPushSubscribed(deviceId: string): void {
  enqueue({ type: 'push.subscribed', deviceId });
}

export function emitPushUnsubscribed(deviceId: string): void {
  enqueue({ type: 'push.unsubscribed', deviceId });
}

export function emitPushOpened(notificationId?: string, habitId?: string): void {
  const evt: ClientEvent = { type: 'push.opened' };
  if (notificationId !== undefined) (evt as Record<string, unknown>)['notificationId'] = notificationId;
  if (habitId !== undefined) (evt as Record<string, unknown>)['habitId'] = habitId;
  enqueue(evt);
}

export function emitInstallPromptShown(): void {
  enqueue({ type: 'push.install_prompt_shown' });
}

export function emitInstallPromptAccepted(): void {
  enqueue({ type: 'push.install_prompt_accepted' });
}

export function emitInstallPromptDismissed(): void {
  enqueue({ type: 'push.install_prompt_dismissed' });
}
