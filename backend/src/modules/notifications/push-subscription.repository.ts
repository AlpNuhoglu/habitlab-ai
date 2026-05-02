import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { UserScopedRepository } from '../../common/repositories/user-scoped.repository';
import { PushSubscription } from './entities/push-subscription.entity';

interface UpsertData {
  userId: string;
  endpoint: string;
  keysP256dh: string;
  keysAuth: string;
  userAgent: string | null;
}

@Injectable()
export class PushSubscriptionRepository extends UserScopedRepository<PushSubscription> {
  constructor(
    @InjectRepository(PushSubscription)
    protected readonly repo: Repository<PushSubscription>,
  ) {
    super();
  }

  async findByUser(userId: string): Promise<PushSubscription[]> {
    return this.repo.find({ where: { userId } });
  }

  async upsertByEndpoint(data: UpsertData): Promise<{ subscription: PushSubscription; isNew: boolean }> {
    const rows = await this.repo.manager.query<Array<Record<string, unknown>>>(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id     = EXCLUDED.user_id,
         keys_p256dh = EXCLUDED.keys_p256dh,
         keys_auth   = EXCLUDED.keys_auth,
         user_agent  = EXCLUDED.user_agent
       RETURNING *, (xmax = 0) AS is_new`,
      [data.userId, data.endpoint, data.keysP256dh, data.keysAuth, data.userAgent],
    );
    const row = rows[0]!;
    return { subscription: this.mapRow(row), isNew: row['is_new'] as boolean };
  }

  async deleteById(id: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ id, userId });
    return (result.affected ?? 0) > 0;
  }

  private mapRow(row: Record<string, unknown>): PushSubscription {
    const sub = new PushSubscription();
    sub.id = row['id'] as string;
    sub.userId = row['user_id'] as string;
    sub.endpoint = row['endpoint'] as string;
    sub.keysP256dh = row['keys_p256dh'] as string;
    sub.keysAuth = row['keys_auth'] as string;
    sub.userAgent = (row['user_agent'] as string | null) ?? null;
    sub.createdAt = new Date(row['created_at'] as string);
    return sub;
  }
}
