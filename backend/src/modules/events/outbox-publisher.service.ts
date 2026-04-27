import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import {
  BROKER_ADAPTER,
  BrokerAdapter,
  OutboxEvent,
} from '../../infrastructure/broker/broker-adapter.interface';

const POLL_INTERVAL_MS = 200;
const BATCH_SIZE = 100;

interface EventRow {
  id: string;
  user_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisher.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(BROKER_ADAPTER) private readonly broker: BrokerAdapter,
  ) {}

  onModuleInit(): void {
    this.intervalHandle = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private async poll(): Promise<void> {
    // Guard: skip if a previous poll is still in flight
    if (this.running) return;
    this.running = true;

    try {
      await this.dataSource.transaction(async (em) => {
        const rows = await em.query<EventRow[]>(
          `SELECT id, user_id, event_type, aggregate_type, aggregate_id, payload, occurred_at
             FROM events
            WHERE published_at IS NULL
            ORDER BY occurred_at
            LIMIT $1
            FOR UPDATE SKIP LOCKED`,
          [BATCH_SIZE],
        );

        if (rows.length === 0) return;

        const publishedIds: string[] = [];

        for (const row of rows) {
          const event: OutboxEvent = {
            id: row.id,
            userId: row.user_id,
            eventType: row.event_type,
            aggregateType: row.aggregate_type,
            aggregateId: row.aggregate_id,
            payload: row.payload,
            occurredAt: row.occurred_at,
          };

          try {
            await this.broker.publish(event);
            publishedIds.push(row.id);
          } catch (err) {
            this.logger.error(
              `Failed to publish event ${row.id} (${row.event_type}): ${String(err)}`,
            );
          }
        }

        if (publishedIds.length > 0) {
          await em.query(`UPDATE events SET published_at = now() WHERE id = ANY($1::uuid[])`, [
            publishedIds,
          ]);
        }
      });
    } catch (err) {
      this.logger.error(`Outbox poll failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }
}
