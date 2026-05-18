import type {
  INPMetricWithAttribution,
  LCPMetricWithAttribution,
  CLSMetricWithAttribution,
  FCPMetricWithAttribution,
  TTFBMetricWithAttribution,
} from 'web-vitals/attribution';
import { onINP, onLCP, onCLS, onFCP, onTTFB } from 'web-vitals/attribution';

import { enqueue } from '../../events/event-sink';
import type { ClientEvent } from '../../events/client-event';

type MetricName = 'INP' | 'LCP' | 'CLS' | 'FCP' | 'TTFB';

function redactAttribution(
  raw: Record<string, unknown>,
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === 'textContent' || k === 'innerText') continue;
    if (k === 'url' || k === 'href') {
      try {
        result[k] = new URL(String(v)).pathname;
      } catch {
        result[k] = null;
      }
      continue;
    }
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      v === null
    ) {
      result[k] = v;
    }
  }
  return result;
}

type AnyVitalMetric =
  | INPMetricWithAttribution
  | LCPMetricWithAttribution
  | CLSMetricWithAttribution
  | FCPMetricWithAttribution
  | TTFBMetricWithAttribution;

function handleMetric(m: AnyVitalMetric): void {
  const event: ClientEvent = {
    type: 'client.performance',
    metric: m.name as MetricName,
    value: m.value,
    rating: m.rating,
    delta: m.delta,
    id: m.id,
    navigationType: m.navigationType,
    attribution: redactAttribution(m.attribution as unknown as Record<string, unknown>),
  };
  enqueue(event);
}

export function reportWebVitals(): void {
  onINP(handleMetric);
  onLCP(handleMetric);
  onCLS(handleMetric);
  onFCP(handleMetric);
  onTTFB(handleMetric);
}
