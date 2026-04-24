/**
 * Habits + Tracking + Dashboard integration tests (WP3, FR-020..FR-044).
 *
 * Requires a real PostgreSQL instance at DATABASE_URL, freshly migrated.
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
const email = (suffix: string) => `habits+${RUN}+${suffix}@example.com`;

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

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Habits + Tracking + Dashboard (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.use(cookieParser());
    await app.init();

    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── 1. Habit CRUD happy path (FR-020..FR-024) ────────────────────────────

  describe('Habit CRUD happy path', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'crud1'));
    });

    it('POST /habits → 201 with id', async () => {
      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({
          name: 'Meditate 10 min',
          frequencyType: 'daily',
          difficulty: 2,
        })
        .expect(201);

      habitId = (res.body as { id: string }).id;
      expect(habitId).toBeDefined();
    });

    it('GET /habits → lists the new habit', async () => {
      const res = await request(app.getHttpServer())
        .get('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as { data: Array<{ id: string }> };
      expect(body.data.some((h) => h.id === habitId)).toBe(true);
    });

    it('GET /habits/:id → detail with streak fields', async () => {
      const res = await request(app.getHttpServer())
        .get(`/habits/${habitId}`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as {
        id: string;
        currentStreak: number;
        longestStreak: number;
        completionRate30d: number;
      };
      expect(body.id).toBe(habitId);
      expect(typeof body.currentStreak).toBe('number');
      expect(typeof body.longestStreak).toBe('number');
      expect(typeof body.completionRate30d).toBe('number');
    });

    it('PATCH /habits/:id → updates name', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/habits/${habitId}`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Meditate 20 min' })
        .expect(200);

      expect((res.body as { name: string }).name).toBe('Meditate 20 min');
    });

    it('DELETE /habits/:id → archives (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/habits/${habitId}`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(204);
    });

    it('GET /habits → archived habit not in default list', async () => {
      const res = await request(app.getHttpServer())
        .get('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as { data: Array<{ id: string }> };
      expect(body.data.some((h) => h.id === habitId)).toBe(false);
    });

    it('GET /habits?include_archived=true → archived habit visible', async () => {
      const res = await request(app.getHttpServer())
        .get('/habits?include_archived=true')
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as { data: Array<{ id: string }> };
      expect(body.data.some((h) => h.id === habitId)).toBe(true);
    });

    it('POST /habits/:id/unarchive → habit active again', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/unarchive`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as { data: Array<{ id: string }> };
      expect(body.data.some((h) => h.id === habitId)).toBe(true);
    });

    it('DELETE /habits/:id?hard=true → hard delete within 30 days (204)', async () => {
      await request(app.getHttpServer())
        .delete(`/habits/${habitId}?hard=true`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(204);

      const rows: Array<{ id: string }> = await ds.query(
        'SELECT id FROM habits WHERE id = $1',
        [habitId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  // ─── 2. Frequency validation (FR-020) ────────────────────────────────────

  describe('Frequency cross-field validation', () => {
    let cookie: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'freq1'));
    });

    it('weekly without weekdayMask → 400', async () => {
      await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Run', frequencyType: 'weekly' })
        .expect(400);
    });

    it('custom without targetCountPerWeek → 400', async () => {
      await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Run', frequencyType: 'custom' })
        .expect(400);
    });

    it('weekly with weekdayMask → 201', async () => {
      await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Run', frequencyType: 'weekly', weekdayMask: 21 })
        .expect(201);
    });

    it('custom with targetCountPerWeek → 201', async () => {
      await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Swim', frequencyType: 'custom', targetCountPerWeek: 3 })
        .expect(201);
    });
  });

  // ─── 3. Tracking — idempotency (FR-030) ──────────────────────────────────

  describe('Tracking idempotency', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'idem1'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Read', frequencyType: 'daily' })
        .expect(201);
      habitId = (res.body as { id: string }).id;
    });

    it('first POST → 201', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: todayStr() })
        .expect(201);
    });

    it('second POST same date → 200 with updated data', async () => {
      const res = await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'skipped', date: todayStr(), note: 'changed my mind' })
        .expect(200);

      const body = res.body as { log: { status: string; note: string } };
      expect(body.log.status).toBe('skipped');
      expect(body.log.note).toBe('changed my mind');
    });
  });

  // ─── 4. Retroactive limit (FR-032) ────────────────────────────────────────

  describe('Retroactive logging limit', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'retro1'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Stretch', frequencyType: 'daily' })
        .expect(201);
      habitId = (res.body as { id: string }).id;
    });

    it('6 days ago → 201', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: daysAgo(6) })
        .expect(201);
    });

    it('8 days ago → 400 RETRO_LIMIT_EXCEEDED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: daysAgo(8) })
        .expect(400);

      expect((res.body as { type: string }).type).toContain('retro-limit-exceeded');
    });
  });

  // ─── 5. Future date (FR-032) ──────────────────────────────────────────────

  describe('Future date rejection', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'future1'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Journal', frequencyType: 'daily' })
        .expect(201);
      habitId = (res.body as { id: string }).id;
    });

    it('tomorrow → 400 FUTURE_DATE', async () => {
      const tomorrow = daysAgo(-1);
      const res = await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: tomorrow })
        .expect(400);

      expect((res.body as { type: string }).type).toContain('future-date');
    });
  });

  // ─── 6. Archived habit cannot be logged (FR-030) ──────────────────────────

  describe('Archived habit log rejection', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'arch1'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Paint', frequencyType: 'daily' })
        .expect(201);
      habitId = (res.body as { id: string }).id;

      await request(app.getHttpServer())
        .delete(`/habits/${habitId}`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(204);
    });

    it('POST log on archived habit → 409 HABIT_ARCHIVED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed' })
        .expect(409);

      expect((res.body as { type: string }).type).toContain('habit-archived');
    });
  });

  // ─── 7. Cross-user isolation (NFR-038) ────────────────────────────────────

  describe('Cross-user isolation', () => {
    let cookieA: string;
    let cookieB: string;
    let habitIdA: string;

    beforeAll(async () => {
      ({ accessCookie: cookieA } = await registerLoginAndGetCookie(app, 'userA'));
      ({ accessCookie: cookieB } = await registerLoginAndGetCookie(app, 'userB'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookieA}`)
        .send({ name: 'User A habit', frequencyType: 'daily' })
        .expect(201);
      habitIdA = (res.body as { id: string }).id;
    });

    it("user B cannot GET user A's habit → 404", async () => {
      await request(app.getHttpServer())
        .get(`/habits/${habitIdA}`)
        .set('Cookie', `access_token=${cookieB}`)
        .expect(404);
    });

    it("user B cannot PATCH user A's habit → 404", async () => {
      await request(app.getHttpServer())
        .patch(`/habits/${habitIdA}`)
        .set('Cookie', `access_token=${cookieB}`)
        .send({ name: 'Hijacked' })
        .expect(404);
    });

    it("user B cannot log user A's habit → 404", async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitIdA}/log`)
        .set('Cookie', `access_token=${cookieB}`)
        .send({ status: 'completed' })
        .expect(404);
    });
  });

  // ─── 8. Delete log within 7 days (FR-033) ────────────────────────────────

  describe('Delete log', () => {
    let cookie: string;
    let habitId: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'del1'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Yoga', frequencyType: 'daily' })
        .expect(201);
      habitId = (res.body as { id: string }).id;
    });

    it('log today then DELETE → 204', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: todayStr() })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/habits/${habitId}/log/${todayStr()}`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(204);
    });

    it('DELETE 8-day-old date → 400 RETRO_LIMIT_EXCEEDED', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/habits/${habitId}/log/${daysAgo(8)}`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(400);

      expect((res.body as { type: string }).type).toContain('retro-limit-exceeded');
    });
  });

  // ─── 9. Dashboard response shape (FR-040) ─────────────────────────────────

  describe('Dashboard response shape', () => {
    let cookie: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'dash1'));

      // Create two habits and log one
      const r1 = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'H1', frequencyType: 'daily' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'H2', frequencyType: 'daily' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/habits/${(r1.body as { id: string }).id}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed' })
        .expect(201);
    });

    it('GET /dashboard → 200 with correct shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Cookie', `access_token=${cookie}`)
        .expect(200);

      const body = res.body as {
        summary: {
          activeHabits: number;
          todayCompleted: number;
          todaySkipped: number;
          todayPending: number;
          overallCompletionRate30d: number;
          longestStreakAnyHabit: number;
        };
        habits: Array<{
          id: string;
          name: string;
          frequencyType: string;
          currentStreak: number;
          completionRate30d: number;
          todayStatus: string;
        }>;
        activeRecommendations: unknown[];
      };

      expect(body.summary.activeHabits).toBe(2);
      expect(body.summary.todayCompleted).toBe(1);
      expect(body.summary.todayPending).toBe(1);
      expect(typeof body.summary.overallCompletionRate30d).toBe('number');
      expect(typeof body.summary.longestStreakAnyHabit).toBe('number');
      expect(body.habits).toHaveLength(2);
      expect(body.activeRecommendations).toEqual([]);

      const completedHabit = body.habits.find((h) => h.todayStatus === 'completed');
      expect(completedHabit).toBeDefined();
      expect(completedHabit?.currentStreak).toBe(1);

      // X-Cache header must be MISS in WP3
      expect(res.headers['x-cache']).toBe('MISS');
    });
  });

  // ─── 10. FR-025 hard-delete limit ─────────────────────────────────────────

  describe('Hard delete limit (FR-025)', () => {
    let cookie: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'hdel1'));
    });

    it('habit with old creation date and logs → 409 HARD_DELETE_LIMIT', async () => {
      // Create habit then backdate its created_at via raw SQL so the 30-day check triggers.
      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Old habit', frequencyType: 'daily' })
        .expect(201);

      const habitId = (res.body as { id: string }).id;

      // Backdate creation and add a log to satisfy the condition
      await ds.query(
        `UPDATE habits SET created_at = now() - INTERVAL '31 days' WHERE id = $1`,
        [habitId],
      );
      await ds.query(
        `INSERT INTO habit_logs (habit_id, user_id, log_date, status)
         SELECT id, user_id, CURRENT_DATE - 5, 'completed' FROM habits WHERE id = $1`,
        [habitId],
      );

      const delRes = await request(app.getHttpServer())
        .delete(`/habits/${habitId}?hard=true`)
        .set('Cookie', `access_token=${cookie}`)
        .expect(409);

      expect((delRes.body as { type: string }).type).toContain('hard-delete-limit');
    });
  });
});
