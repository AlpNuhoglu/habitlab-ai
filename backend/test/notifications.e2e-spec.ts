/**
 * Web push notifications integration tests (WP9, FR-060..FR-064).
 *
 * Requires a real PostgreSQL instance at DATABASE_URL, freshly migrated.
 * WebPushService is disabled in test mode (no VAPID keys) — send() is a no-op that returns 'ok'.
 * Scheduler interval does NOT start; tick() is called directly.
 *
 * Run locally:
 *   DATABASE_URL=postgres://... npm run test:e2e -- --testPathPattern=notifications
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { NotificationSchedulerService } from '../src/modules/notifications/notification-scheduler.service';
import { WebPushService } from '../src/modules/notifications/web-push.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCookies(res: { headers: Record<string, unknown> }): string[] {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') return [raw];
  return [];
}

function extractCookie(cookies: string[], name: string): string | undefined {
  const found = cookies.find((c) => c.startsWith(name + '='));
  return found?.split(';')[0]?.slice(name.length + 1);
}

const RUN = Date.now();
const email = (suffix: string) => `notif+${RUN}+${suffix}@example.com`;

async function registerLoginAndGetCookie(
  app: INestApplication,
  suffix: string,
): Promise<{ accessCookie: string; userId: string }> {
  const regRes = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email: email(suffix),
      password: 'Password1',
      timezone: 'UTC',
      locale: 'en',
      consentGiven: true,
    })
    .expect(202);

  const userId = (regRes.body as { userId: string }).userId;

  const secret = app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET');
  const verifyToken = jwt.sign({ sub: userId, purpose: 'email_verify' }, secret, {
    expiresIn: '24h',
  });
  await request(app.getHttpServer()).get('/auth/verify').query({ token: verifyToken }).expect(200);

  const loginRes = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: email(suffix), password: 'Password1' })
    .expect(200);

  const cookies = getCookies(loginRes);
  const accessCookie = extractCookie(cookies, 'access_token');
  if (!accessCookie) throw new Error('No access_token cookie after login');

  return { accessCookie, userId };
}

function currentUTCHHMM(): string {
  const now = new Date();
  const h = now.getUTCHours().toString().padStart(2, '0');
  const m = now.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function fakeEndpoint(suffix: string): string {
  return `https://push.example.test/${RUN}/${suffix}`;
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Web push notifications (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let scheduler: NotificationSchedulerService;
  let webPush: WebPushService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.use(cookieParser());
    await app.init();

    ds = app.get(DataSource);
    scheduler = app.get(NotificationSchedulerService);
    webPush = app.get(WebPushService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── FR-060: subscribe ───────────────────────────────────────────────────

  describe('POST /notifications/subscriptions (FR-060)', () => {
    it('creates a new subscription and returns 201', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'sub1');
      const endpoint = fakeEndpoint('sub1');

      const res = await request(app.getHttpServer())
        .post('/notifications/subscriptions')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ endpoint, keys: { p256dh: 'fakep256dh', auth: 'fakeauth' }, userAgent: 'Jest/1.0' })
        .expect(201);

      const body = res.body as { id: string };
      expect(typeof body.id).toBe('string');

      const rows = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(body.id);
    });

    it('upserts on duplicate endpoint and returns 200', async () => {
      const { accessCookie } = await registerLoginAndGetCookie(app, 'sub2');
      const endpoint = fakeEndpoint('sub2');

      await request(app.getHttpServer())
        .post('/notifications/subscriptions')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ endpoint, keys: { p256dh: 'key1', auth: 'auth1' } })
        .expect(201);

      // Second call with same endpoint → 200
      await request(app.getHttpServer())
        .post('/notifications/subscriptions')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ endpoint, keys: { p256dh: 'key2', auth: 'auth2' } })
        .expect(201);

      // Still only one row in DB
      const rows = await ds.query<Array<{ keys_p256dh: string }>>(
        `SELECT keys_p256dh FROM push_subscriptions WHERE endpoint = $1`,
        [endpoint],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.keys_p256dh).toBe('key2');
    });

    it('returns 401 without auth cookie', async () => {
      await request(app.getHttpServer())
        .post('/notifications/subscriptions')
        .send({ endpoint: fakeEndpoint('unauth'), keys: { p256dh: 'k', auth: 'a' } })
        .expect(401);
    });
  });

  // ─── FR-061: unsubscribe ─────────────────────────────────────────────────

  describe('DELETE /notifications/subscriptions/:id (FR-061)', () => {
    it('deletes a subscription and returns 204', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'del1');
      const endpoint = fakeEndpoint('del1');

      const createRes = await request(app.getHttpServer())
        .post('/notifications/subscriptions')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ endpoint, keys: { p256dh: 'p256', auth: 'auth' } })
        .expect(201);

      const { id } = createRes.body as { id: string };

      await request(app.getHttpServer())
        .delete(`/notifications/subscriptions/${id}`)
        .set('Cookie', [`access_token=${accessCookie}`])
        .expect(204);

      const rows = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint],
      );
      expect(rows).toHaveLength(0);
    });

    it('returns 404 when subscription belongs to another user', async () => {
      const user1 = await registerLoginAndGetCookie(app, 'del2a');
      const user2 = await registerLoginAndGetCookie(app, 'del2b');
      const endpoint = fakeEndpoint('del2');

      const createRes = await request(app.getHttpServer())
        .post('/notifications/subscriptions')
        .set('Cookie', [`access_token=${user1.accessCookie}`])
        .send({ endpoint, keys: { p256dh: 'p256', auth: 'auth' } })
        .expect(201);

      const { id } = createRes.body as { id: string };

      // User 2 tries to delete user 1's subscription
      await request(app.getHttpServer())
        .delete(`/notifications/subscriptions/${id}`)
        .set('Cookie', [`access_token=${user2.accessCookie}`])
        .expect(404);
    });
  });

  // ─── Scheduler: happy path ───────────────────────────────────────────────

  describe('NotificationSchedulerService.tick()', () => {
    it('sends notification and records notifications_sent when preferred_time matches', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'sched1');
      const endpoint = fakeEndpoint('sched1');

      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ name: 'Morning habit', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      // Set preferred_time = now (user timezone is UTC)
      const preferredTime = currentUTCHHMM();
      await ds.query(`UPDATE habits SET preferred_time = $1 WHERE id = $2`, [
        preferredTime,
        habitId,
      ]);

      // Add push subscription directly
      await ds.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
         VALUES ($1, $2, 'fakep256dh', 'fakeauth')`,
        [userId, endpoint],
      );

      await scheduler.tick();

      const sent = await ds.query<Array<{ template_key: string; variant_key: string | null }>>(
        `SELECT template_key, variant_key
         FROM notifications_sent
         WHERE user_id = $1 AND habit_id = $2`,
        [userId, habitId],
      );
      expect(sent).toHaveLength(1);
      // Template depends on whether notification_copy_v1 experiment is running in shared test DB
      expect(['habit_reminder_v1', 'habit_reminder_motivated_v1']).toContain(sent[0]!.template_key);

      const events = await ds.query<Array<{ event_type: string }>>(
        `SELECT event_type FROM events
         WHERE user_id = $1 AND event_type = 'notification.sent'`,
        [userId],
      );
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('does not notify when preferred_time does not match', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'sched2');

      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ name: 'Night habit', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      // Set preferred_time 2 hours from now — well outside the ±1 min window
      const now = new Date();
      const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const fh = future.getUTCHours().toString().padStart(2, '0');
      const fm = future.getUTCMinutes().toString().padStart(2, '0');
      await ds.query(`UPDATE habits SET preferred_time = $1 WHERE id = $2`, [
        `${fh}:${fm}`,
        habitId,
      ]);

      await ds.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
         VALUES ($1, $2, 'fakep256dh', 'fakeauth')`,
        [userId, fakeEndpoint('sched2')],
      );

      await scheduler.tick();

      const sent = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM notifications_sent WHERE user_id = $1`,
        [userId],
      );
      expect(sent).toHaveLength(0);
    });

    it('skips notification when current time falls within quiet hours', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'sched3');

      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ name: 'Quiet habit', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      const preferredTime = currentUTCHHMM();
      await ds.query(`UPDATE habits SET preferred_time = $1 WHERE id = $2`, [
        preferredTime,
        habitId,
      ]);

      // Set quiet hours to cover all day
      await ds.query(
        `UPDATE users
         SET preferences = preferences || '{"quiet_hours": {"start": "00:00", "end": "23:59"}}'::jsonb
         WHERE id = $1`,
        [userId],
      );

      await ds.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
         VALUES ($1, $2, 'fakep256dh', 'fakeauth')`,
        [userId, fakeEndpoint('sched3')],
      );

      await scheduler.tick();

      const sent = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM notifications_sent WHERE user_id = $1`,
        [userId],
      );
      expect(sent).toHaveLength(0);
    });

    it('does not send duplicate notifications within the same day', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'sched4');

      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ name: 'Dedup habit', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      const preferredTime = currentUTCHHMM();
      await ds.query(`UPDATE habits SET preferred_time = $1 WHERE id = $2`, [
        preferredTime,
        habitId,
      ]);

      await ds.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
         VALUES ($1, $2, 'fakep256dh', 'fakeauth')`,
        [userId, fakeEndpoint('sched4')],
      );

      await scheduler.tick();
      await scheduler.tick();

      const sent = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM notifications_sent WHERE user_id = $1 AND habit_id = $2`,
        [userId, habitId],
      );
      expect(sent).toHaveLength(1);
    });

    it('removes stale subscription when send() returns gone', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'sched5');
      const endpoint = fakeEndpoint('sched5');

      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ name: 'Gone habit', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      const preferredTime = currentUTCHHMM();
      await ds.query(`UPDATE habits SET preferred_time = $1 WHERE id = $2`, [
        preferredTime,
        habitId,
      ]);

      await ds.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
         VALUES ($1, $2, 'fakep256dh', 'fakeauth')`,
        [userId, endpoint],
      );

      // Make WebPushService.send() return 'gone' for this test
      const spy = jest.spyOn(webPush, 'send').mockResolvedValue('gone');

      await scheduler.tick();

      // Subscription should be deleted (410 Gone cleanup)
      const subs = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint],
      );
      expect(subs).toHaveLength(0);

      // No notifications_sent record (send was 'gone', not 'ok')
      const sent = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM notifications_sent WHERE user_id = $1`,
        [userId],
      );
      expect(sent).toHaveLength(0);

      spy.mockRestore();
    });

    it('uses motivated variant copy when notification_copy_v1 experiment is active', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'sched6');
      const endpoint = fakeEndpoint('sched6');

      // Seed the notification copy experiment
      await ds.query(
        `INSERT INTO experiments (key, name, variants, primary_metric, status)
         VALUES ('notification_copy_v1', 'Notification copy test', $1::jsonb, 'open_rate', 'running')
         ON CONFLICT (key) DO UPDATE SET status = 'running'`,
        [
          JSON.stringify([
            { key: 'control', weight: 1 },
            { key: 'motivated', weight: 99 }, // force motivated for most users
          ]),
        ],
      );

      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ name: 'Streak habit', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      const preferredTime = currentUTCHHMM();
      await ds.query(`UPDATE habits SET preferred_time = $1 WHERE id = $2`, [
        preferredTime,
        habitId,
      ]);

      await ds.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth)
         VALUES ($1, $2, 'fakep256dh', 'fakeauth')`,
        [userId, endpoint],
      );

      await scheduler.tick();

      const sent = await ds.query<
        Array<{ template_key: string; variant_key: string; rendered_body: string }>
      >(
        `SELECT template_key, variant_key, rendered_body
         FROM notifications_sent WHERE user_id = $1 AND habit_id = $2`,
        [userId, habitId],
      );

      // Should have recorded either control or motivated (deterministic based on userId hash)
      expect(sent).toHaveLength(1);
      expect(['habit_reminder_v1', 'habit_reminder_motivated_v1']).toContain(sent[0]!.template_key);
      expect(['control', 'motivated']).toContain(sent[0]!.variant_key);
    });

    it('skips habit with no push subscriptions', async () => {
      const { accessCookie, userId } = await registerLoginAndGetCookie(app, 'sched7');

      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ name: 'No-sub habit', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      const preferredTime = currentUTCHHMM();
      await ds.query(`UPDATE habits SET preferred_time = $1 WHERE id = $2`, [
        preferredTime,
        habitId,
      ]);

      // No push_subscriptions row → scheduler query excludes this user
      await scheduler.tick();

      const sent = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM notifications_sent WHERE user_id = $1`,
        [userId],
      );
      expect(sent).toHaveLength(0);
    });
  });

  // ─── WebPushService disabled in test mode ────────────────────────────────

  describe('WebPushService test mode', () => {
    it('isEnabled() returns false in test environment', () => {
      expect(webPush.isEnabled()).toBe(false);
    });
  });
});
