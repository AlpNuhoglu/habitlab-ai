import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { MetricsService } from '../../infrastructure/metrics/metrics.service';
import { UserPreferences } from '../auth/entities/user.entity';
import { AssignmentService } from '../experiments/assignment.service';
import { NotificationSentRepository } from './notification-sent.repository';
import { PushSubscriptionRepository } from './push-subscription.repository';
import { PushPayload, WebPushService } from './web-push.service';

const TICK_INTERVAL_MS = 60_000;
const EXPERIMENT_KEY = 'notification_copy_v1';

interface HabitRow {
  habit_id: string;
  habit_name: string;
  user_id: string;
  preferred_time: string; // 'HH:MM:SS'
  timezone: string;
  preferences: UserPreferences;
}

interface CopyTemplate {
  key: string;
  body: (habitName: string) => string;
}

const TEMPLATES: Record<string, CopyTemplate> = {
  motivated: {
    key: 'habit_reminder_motivated_v1',
    body: (n) => `Keep the streak going — it's time for: ${n}`,
  },
  control: {
    key: 'habit_reminder_v1',
    body: (n) => `Time to complete: ${n}`,
  },
};

function getTemplate(variant: string | null): CopyTemplate {
  return TEMPLATES[variant ?? 'control'] ?? TEMPLATES['control']!;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function getCurrentMinutesInTimezone(timezone: string): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  let hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  // Intl may return 24 for midnight
  if (hour === 24) hour = 0;
  return hour * 60 + minute;
}

function isWithinOneMinute(nowMinutes: number, targetMinutes: number): boolean {
  const diff = Math.abs(nowMinutes - targetMinutes);
  // Handle midnight wrap
  return Math.min(diff, 1440 - diff) <= 1;
}

function isInQuietHours(nowMinutes: number, quietHours: { start: string; end: string }): boolean {
  const start = parseTimeToMinutes(quietHours.start);
  const end = parseTimeToMinutes(quietHours.end);
  if (start > end) {
    // Overnight span (e.g. 22:00–07:00)
    return nowMinutes >= start || nowMinutes <= end;
  }
  return nowMinutes >= start && nowMinutes <= end;
}

@Injectable()
export class NotificationSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly webPushService: WebPushService,
    private readonly pushSubscriptionRepo: PushSubscriptionRepository,
    private readonly notificationSentRepo: NotificationSentRepository,
    private readonly assignmentService: AssignmentService,
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit(): void {
    if (!this.webPushService.isEnabled()) {
      this.logger.log('Notification scheduler inactive — WebPush disabled');
      return;
    }
    this.intervalHandle = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
    this.logger.log('Notification scheduler started (60s interval)');
  }

  onModuleDestroy(): void {
    if (this.intervalHandle !== null) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.runTick();
    } catch (err) {
      this.logger.error(`Scheduler tick failed: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async runTick(): Promise<void> {
    const habits = await this.dataSource.query<HabitRow[]>(
      `SELECT h.id          AS habit_id,
              h.name        AS habit_name,
              h.user_id,
              h.preferred_time::text AS preferred_time,
              u.timezone,
              u.preferences
       FROM habits h
       JOIN users u ON u.id = h.user_id
       WHERE h.is_active     = true
         AND h.archived_at   IS NULL
         AND h.preferred_time IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = h.user_id
         )`,
    );

    for (const row of habits) {
      try {
        await this.processHabit(row);
      } catch (err) {
        this.logger.error(
          `Failed to process habit ${row.habit_id} for user ${row.user_id}: ${String(err)}`,
        );
      }
    }
  }

  private async processHabit(row: HabitRow): Promise<void> {
    const now = getCurrentMinutesInTimezone(row.timezone);
    const preferred = parseTimeToMinutes(row.preferred_time);

    // 1. Time window check (±1 minute)
    if (!isWithinOneMinute(now, preferred)) return;

    // 2. Quiet hours check
    const quietHours = row.preferences.quiet_hours;
    if (quietHours && isInQuietHours(now, quietHours)) {
      this.logger.debug(`Quiet hours active for user ${row.user_id} — skipping habit ${row.habit_id}`);
      return;
    }

    // 3. De-dup: already sent today?
    const alreadySent = await this.notificationSentRepo.findSentTodayForHabit(
      row.user_id,
      row.habit_id,
      row.timezone,
    );
    if (alreadySent) {
      this.logger.debug(`Already notified for habit ${row.habit_id} today — skipping`);
      return;
    }

    // 4. Subscriptions
    const subscriptions = await this.pushSubscriptionRepo.findByUser(row.user_id);
    if (subscriptions.length === 0) return;

    // 5. Variant assignment (before transaction — same pattern as rec worker)
    let variant: string | null = null;
    try {
      variant = await this.assignmentService.getOrAssignIfActive(row.user_id, EXPERIMENT_KEY);
    } catch (err) {
      this.logger.warn(`Could not resolve experiment variant for ${row.user_id}: ${String(err)}`);
    }

    // 6. Render copy
    const template = getTemplate(variant);
    const renderedBody = template.body(row.habit_name);
    const payload: PushPayload = { title: 'HabitLab', body: renderedBody, habitId: row.habit_id };

    // 7. Send to each subscription; collect stale ones
    let anySent = false;
    const goneIds: Array<{ id: string; userId: string }> = [];

    for (const sub of subscriptions) {
      const result = await this.webPushService.send(sub, payload);
      if (result === 'ok') { anySent = true; this.metrics.notificationsSentTotal.inc(); }
      if (result === 'gone') goneIds.push({ id: sub.id, userId: sub.userId });
    }

    // 8. Clean up stale subscriptions
    for (const gone of goneIds) {
      await this.pushSubscriptionRepo.deleteById(gone.id, gone.userId);
      this.logger.debug(`Removed stale subscription ${gone.id}`);
    }

    if (!anySent) return;

    // 9. Record notification + emit event in a single transaction
    await this.dataSource.transaction(async (em) => {
      const sent = await this.notificationSentRepo.insert(
        {
          userId: row.user_id,
          habitId: row.habit_id,
          variantKey: variant,
          templateKey: template.key,
          renderedBody,
        },
        em,
      );

      await em.query(
        `INSERT INTO events (user_id, event_type, aggregate_type, aggregate_id, payload)
         VALUES ($1, 'notification.sent', 'notification', $2, $3)`,
        [
          row.user_id,
          sent.id,
          JSON.stringify({ habitId: row.habit_id, templateKey: template.key, variantKey: variant }),
        ],
      );
    });

    this.logger.debug(
      `Sent notification for habit ${row.habit_id} to user ${row.user_id} (variant: ${variant ?? 'none'})`,
    );
  }
}
