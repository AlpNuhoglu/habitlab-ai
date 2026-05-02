import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });

  readonly httpRequestErrorsTotal = new Counter({
    name: 'http_request_errors_total',
    help: 'Total HTTP requests that resulted in an error (status >= 400)',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });

  readonly eventsPublishedTotal = new Counter({
    name: 'habitlab_events_published_total',
    help: 'Total domain events published to the broker',
    registers: [this.registry],
  });

  readonly recommendationsGeneratedTotal = new Counter({
    name: 'habitlab_recommendations_generated_total',
    help: 'Total recommendations generated',
    labelNames: ['source'] as const,
    registers: [this.registry],
  });

  readonly notificationsSentTotal = new Counter({
    name: 'habitlab_notifications_sent_total',
    help: 'Total push notifications sent successfully',
    registers: [this.registry],
  });

  // Gauge so it can reflect accumulated cost without requiring a running total query
  readonly llmCostCentsTotal = new Gauge({
    name: 'habitlab_llm_cost_cents_total',
    help: 'Cumulative LLM cost in cents (in-process; resets on restart)',
    registers: [this.registry],
  });

  private llmCostAccumulator = 0;

  onModuleInit(): void {
    collectDefaultMetrics({ register: this.registry });
  }

  addLlmCost(cents: number): void {
    this.llmCostAccumulator += cents;
    this.llmCostCentsTotal.set(this.llmCostAccumulator);
  }
}
