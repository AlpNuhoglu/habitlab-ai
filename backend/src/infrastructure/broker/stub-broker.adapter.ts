import { Injectable } from '@nestjs/common';

import type { BrokerAdapter, OutboxEvent } from './broker-adapter.interface';

@Injectable()
export class StubBrokerAdapter implements BrokerAdapter {
  private readonly published: OutboxEvent[] = [];

  async publish(event: OutboxEvent): Promise<void> {
    this.published.push(event);
  }

  getPublished(): OutboxEvent[] {
    return [...this.published];
  }

  reset(): void {
    this.published.length = 0;
  }
}
