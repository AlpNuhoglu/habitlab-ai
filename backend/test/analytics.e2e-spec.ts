/**
 * Analytics worker + endpoints integration tests (WP5, FR-041..FR-043).
 *
 * Requires a real PostgreSQL instance at DATABASE_URL, freshly migrated.
 * Cache is always a MISS in tests (NullCacheAdapter via NODE_ENV=test).
 * The analytics worker's handleEvent() is called directly — no Redis required.
 *
 * Run locally:
 *   DATABASE_URL=postgres://... npm run test:e2e
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { BROKER_ADAPTER } from '../src/infrastructure/broker/broker-adapter.interface';
import type { StubBrokerAdapter } from '../src/infrastructure/broker/stub-broker.adapter';
import { AnalyticsWorkerService } from '../src/modules/analytics/analytics-worker.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
const email = (suffix: string) => `analytics+${RUN}+${suffix}@example.com`;

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

function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC' }).format(new Date());
}

function daysAgo(n: number): string {
  const d = new Date(todayStr() + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Drain events emitted by stub broker and feed them to the analytics worker.
// Waits 400ms first so OutboxPublisher (200ms interval) has time to pick up
// DB events and publish them to the stub before we read from it.
async function drainEventsToWorker(
  app: INestApplication,
  stub: StubBrokerAdapter,
): Promise<void> {
  await sleep(400);
  const worker = app.get(AnalyticsWorkerService);
  const events = stub.getPublished();
  stub.reset();
  for (const event of events) {
    await worker.handleEvent(event);
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Analytics worker + endpoints (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let stub: StubBrokerAdapter;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.use(cookieParser());
    await app.init();

    ds = app.get(DataSource);
    stub = app.get<StubBrokerAdapter>(BROKER_ADAPTER);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── 1. Analytics worker: habit_analytics recompute ───────────────────────

  describe('AnalyticsWorkerService — habit_analytics recompute', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'worker1'));

      // Create a habit
      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Morning Run', frequencyType: 'daily', difficulty: 3 })
        .expect(201);
      habitId = (res.body as { id: string }).id;
      stub.reset();
    });

    it('updates habit_analytics after habit.completed event', async () => {
      // Log habit as completed today
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: todayStr() })
        .expect(201);

      await drainEventsToWorker(app, stub);

      const [row] = await ds.query<Array<{ current_streak: number; completion_rate_30d: string }>>(
        `SELECT current_streak, completion_rate_30d FROM habit_analytics WHERE habit_id = $1`,
        [habitId],
      );

      expect(row).toBeDefined();
      expect(row!.current_streak).toBe(1);
      expect(parseFloat(row!.completion_rate_30d)).toBeGreaterThan(0);
    });

    it('reflects 3-day streak after logging 3 consecutive days', async () => {
      // Log 2 more past days
      for (const d of [daysAgo(2), daysAgo(1)]) {
        await request(app.getHttpServer())
          .post(`/habits/${habitId}/log`)
          .set('Cookie', `access_token=${cookie}`)
          .send({ status: 'completed', date: d })
          .expect(201);
      }

      await drainEventsToWorker(app, stub);

      const [row] = await ds.query<Array<{ current_streak: number; longest_streak: number }>>(
        `SELECT current_streak, longest_streak FROM habit_analytics WHERE habit_id = $1`,
        [habitId],
      );

      expect(row!.current_streak).toBe(3);
      expect(row!.longest_streak).toBe(3);
    });

    it('populates completion_by_weekday and completion_by_hour arrays', async () => {
      const [row] = await ds.query<
        Array<{ completion_by_weekday: number[]; completion_by_hour: number[] }>
      >(
        `SELECT completion_by_weekday, completion_by_hour FROM habit_analytics WHERE habit_id = $1`,
        [habitId],
      );

      expect(Array.isArray(row!.completion_by_weekday)).toBe(true);
      expect(row!.completion_by_weekday).toHaveLength(7);
      expect(Array.isArray(row!.completion_by_hour)).toBe(true);
      expect(row!.completion_by_hour).toHaveLength(24);
      // At least one slot has a count > 0
      expect(row!.completion_by_weekday.some((v) => v > 0)).toBe(true);
    });

    it('idempotency: replaying the same event does not double-count', async () => {
      // Manually replay the last published event (before stub.reset above)
      const logRes = await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: todayStr() })
        .expect(200); // 200 = upsert (already logged today)

      void logRes; // result not needed

      // Collect the event and replay it twice
      const events = stub.getPublished();
      stub.reset();
      const worker = app.get(AnalyticsWorkerService);
      for (const event of events) {
        await worker.handleEvent(event);
        await worker.handleEvent(event); // second call must be no-op
      }

      const [row] = await ds.query<Array<{ current_streak: number }>>(
        `SELECT current_streak FROM habit_analytics WHERE habit_id = $1`,
        [habitId],
      );

      // Streak should still be 3 — idempotent recompute is fine (recomputes from source),
      // but duplicate event must not corrupt processed_events by inserting twice
      expect(row!.current_streak).toBe(3);
    });
  });

  // ─── 2. Analytics worker: user_analytics recompute ────────────────────────

  describe('AnalyticsWorkerService — user_analytics recompute', () => {
    let cookie: string;
    let userId: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie, userId } = await registerLoginAndGetCookie(app, 'worker2'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Read 30 pages', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      habitId = (res.body as { id: string }).id;
      stub.reset();
    });

    it('creates user_analytics row after first completion event', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: todayStr() })
        .expect(201);

      await drainEventsToWorker(app, stub);

      const [row] = await ds.query<
        Array<{
          total_completions_30d: number;
          current_longest_streak: number;
        }>
      >(
        `SELECT total_completions_30d, current_longest_streak FROM user_analytics WHERE user_id = $1`,
        [userId],
      );

      expect(row).toBeDefined();
      expect(row!.total_completions_30d).toBeGreaterThanOrEqual(1);
      expect(row!.current_longest_streak).toBeGreaterThanOrEqual(1);
    });

    it('updates total_skips_30d after skip event', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'skipped', date: daysAgo(3) })
        .expect(201);

      await drainEventsToWorker(app, stub);

      const [row] = await ds.query<Array<{ total_skips_30d: number }>>(
        `SELECT total_skips_30d FROM user_analytics WHERE user_id = $1`,
        [userId],
      );

      expect(row!.total_skips_30d).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── 3. Dashboard X-Cache header (NullCacheAdapter → always MISS) ─────────

  describe('GET /dashboard — X-Cache header', () => {
    let cookie: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'dash1'));
    });

    it('returns X-Cache: MISS on first request (NullCacheAdapter in test)', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      expect(res.headers['x-cache']).toBe('MISS');
    });

    it('returns X-Cache: MISS on second request (NullCacheAdapter never stores)', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      expect(res.headers['x-cache']).toBe('MISS');
    });
  });

  // ─── 4. GET /habits/:id/analytics (FR-041) ────────────────────────────────

  describe('GET /habits/:id/analytics', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'anal1'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Journal', frequencyType: 'daily', difficulty: 1 })
        .expect(201);
      habitId = (res.body as { id: string }).id;
      stub.reset();

      // Log 5 completions
      for (let i = 4; i >= 0; i--) {
        await request(app.getHttpServer())
          .post(`/habits/${habitId}/log`)
          .set('Cookie', `access_token=${cookie}`)
          .send({ status: 'completed', date: daysAgo(i) })
          .expect(i === 0 ? 201 : 201);
      }
      await drainEventsToWorker(app, stub);
    });

    it('returns correct completion rates and streak', async () => {
      const res = await request(app.getHttpServer())
        .get(`/habits/${habitId}/analytics`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as {
        currentStreak: number;
        longestStreak: number;
        completionRate7d: number;
        completionRate30d: number;
        completionRateAllTime: number;
        completionByWeekday: number[];
        completionByHour: number[];
        monthlyTrend: Array<{ month: string; rate: number }>;
      };

      expect(body.currentStreak).toBe(5);
      expect(body.longestStreak).toBe(5);
      expect(body.completionRate7d).toBeGreaterThan(0);
      expect(body.completionRate30d).toBeGreaterThan(0);
      expect(body.completionRateAllTime).toBeGreaterThan(0);
      expect(body.completionByWeekday).toHaveLength(7);
      expect(body.completionByHour).toHaveLength(24);
      expect(Array.isArray(body.monthlyTrend)).toBe(true);
      expect(body.monthlyTrend.length).toBeGreaterThan(0);
    });

    it('returns 404 if habit has no analytics yet', async () => {
      const newHabitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'No logs yet', frequencyType: 'daily', difficulty: 1 })
        .expect(201);

      const newHabitId = (newHabitRes.body as { id: string }).id;

      await request(app.getHttpServer())
        .get(`/habits/${newHabitId}/analytics`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(404);
    });

    it('returns 401 for unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`/habits/${habitId}/analytics`)
        .expect(401);
    });
  });

  // ─── 5. GET /habits/:id/calendar (FR-042) ─────────────────────────────────

  describe('GET /habits/:id/calendar', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'cal1'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Yoga', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      habitId = (res.body as { id: string }).id;

      // Log completed + skipped
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: daysAgo(2) })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'skipped', date: daysAgo(1) })
        .expect(201);
    });

    it('returns log entries within the window', async () => {
      const from = daysAgo(7);
      const to = todayStr();

      const res = await request(app.getHttpServer())
        .get(`/habits/${habitId}/calendar`)
        .query({ from, to })
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as Array<{ date: string; status: string }>;
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);

      const dates = body.map((e) => e.date);
      expect(dates).toContain(daysAgo(2));
      expect(dates).toContain(daysAgo(1));

      const completedEntry = body.find((e) => e.date === daysAgo(2));
      expect(completedEntry?.status).toBe('completed');
    });

    it('rejects window > 365 days', async () => {
      const from = daysAgo(366);
      const to = todayStr();

      await request(app.getHttpServer())
        .get(`/habits/${habitId}/calendar`)
        .query({ from, to })
        .set('Cookie', `access_token=${cookie}`)
        .expect(400);
    });

    it('rejects invalid date format', async () => {
      await request(app.getHttpServer())
        .get(`/habits/${habitId}/calendar`)
        .query({ from: '01-01-2026', to: todayStr() })
        .set('Cookie', `access_token=${cookie}`)
        .expect(400);
    });

    it('rejects from > to', async () => {
      await request(app.getHttpServer())
        .get(`/habits/${habitId}/calendar`)
        .query({ from: todayStr(), to: daysAgo(1) })
        .set('Cookie', `access_token=${cookie}`)
        .expect(400);
    });
  });

  // ─── 6. GET /analytics (FR-043) ───────────────────────────────────────────

  describe('GET /analytics', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'global1'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Drink Water', frequencyType: 'daily', difficulty: 1 })
        .expect(201);
      habitId = (res.body as { id: string }).id;
      stub.reset();

      // Log several completions
      for (let i = 5; i >= 0; i--) {
        await request(app.getHttpServer())
          .post(`/habits/${habitId}/log`)
          .set('Cookie', `access_token=${cookie}`)
          .send({ status: 'completed', date: daysAgo(i) })
          .expect(201);
      }

      await drainEventsToWorker(app, stub);
    });

    it('returns global analytics with required fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/analytics')
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as {
        completionRateOverall: number;
        completionRate7d: number;
        completionRateAllTime: number;
        mostConsistentHabitId: string | null;
        mostStrugglingHabitId: unknown;
        bestWeekday: number | null;
        bestHourOfDay: number | null;
        totalLogs30d: number;
        totalCompletions30d: number;
        totalSkips30d: number;
      };

      expect(typeof body.completionRateOverall).toBe('number');
      expect(typeof body.completionRate7d).toBe('number');
      expect(typeof body.completionRateAllTime).toBe('number');
      expect(body.mostConsistentHabitId).toBe(habitId);
      expect(body.totalCompletions30d).toBeGreaterThanOrEqual(6);
      expect(body.totalLogs30d).toBeGreaterThanOrEqual(6);
    });

    it('returns user-scoped data (other user gets independent result)', async () => {
      const { accessCookie: otherCookie } = await registerLoginAndGetCookie(app, 'global2');

      const res = await request(app.getHttpServer())
        .get('/analytics')
        .set('Cookie', `access_token=${otherCookie}`)
        .expect(200);

      const body = res.body as { mostConsistentHabitId: string | null };
      // New user with no habits — mostConsistentHabitId should be null
      expect(body.mostConsistentHabitId).toBeNull();
    });
  });
});
