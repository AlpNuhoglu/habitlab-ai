export interface OutboxEvent {
  id: string;
  userId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface BrokerAdapter {
  publish(event: OutboxEvent): Promise<void>;
}

export const BROKER_ADAPTER = Symbol('BrokerAdapter');
