import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { UserScopedRepository } from '../../common/repositories/user-scoped.repository';
import { NotificationSent } from './entities/notification-sent.entity';

interface InsertData {
  userId: string;
  habitId: string;
  variantKey: string | null;
  templateKey: string;
  renderedBody: string;
}

@Injectable()
export class NotificationSentRepository extends UserScopedRepository<NotificationSent> {
  constructor(
    @InjectRepository(NotificationSent)
    protected readonly repo: Repository<NotificationSent>,
  ) {
    super();
  }

  async findSentTodayForHabit(userId: string, habitId: string, timezone: string): Promise<boolean> {
    const rows = await this.repo.manager.query<Array<{ id: string }>>(
      `SELECT id FROM notifications_sent
       WHERE user_id = $1
         AND habit_id = $2
         AND channel = 'web_push'
         AND (sent_at AT TIME ZONE $3)::date = (CURRENT_TIMESTAMP AT TIME ZONE $3)::date
       LIMIT 1`,
      [userId, habitId, timezone],
    );
    return rows.length > 0;
  }

  async insert(data: InsertData, em: EntityManager): Promise<NotificationSent> {
    const rows = await em.query<Array<Record<string, unknown>>>(
      `INSERT INTO notifications_sent
         (user_id, habit_id, channel, variant_key, template_key, rendered_body)
       VALUES ($1, $2, 'web_push', $3, $4, $5)
       RETURNING *`,
      [data.userId, data.habitId, data.variantKey, data.templateKey, data.renderedBody],
    );
    if (!rows[0]) throw new Error('INSERT returned no row');
    return this.mapRow(rows[0]);
  }

  async findRecentByUser(userId: string, limit: number): Promise<NotificationSent[]> {
    return this.repo.find({
      where: { userId },
      order: { sentAt: 'DESC' },
      take: limit,
    });
  }

  private mapRow(row: Record<string, unknown>): NotificationSent {
    const n = new NotificationSent();
    n.id = row['id'] as string;
    n.userId = row['user_id'] as string;
    n.habitId = (row['habit_id'] as string | null) ?? null;
    n.channel = row['channel'] as string;
    n.variantKey = (row['variant_key'] as string | null) ?? null;
    n.templateKey = row['template_key'] as string;
    n.renderedBody = (row['rendered_body'] as string | null) ?? null;
    n.sentAt = new Date(row['sent_at'] as string);
    n.deliveredAt = row['delivered_at'] ? new Date(row['delivered_at'] as string) : null;
    n.openedAt = row['opened_at'] ? new Date(row['opened_at'] as string) : null;
    return n;
  }
}
