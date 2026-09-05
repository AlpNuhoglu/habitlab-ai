/**
 * Cross-tenant isolation tests (NFR-038).
 *
 * PostgreSQL RLS is not enabled and the app connects as the table owner, so
 * application-layer `WHERE user_id = $n` filtering is the only thing keeping one
 * user's rows away from another's. These tests assert that boundary from the
 * outside: user B takes every id-parameter endpoint and points it at user A's
 * resources.
 *
 * A pass means "not found", never "here you go" and never a 500. A 404 (rather
 * than 403) is the intended answer -- it does not confirm the id exists.
 *
 * Requires a real PostgreSQL instance at DATABASE_URL, freshly migrated.
 *
 * Run locally:
 *   pnpm db:up && DATABASE_URL=postgres://... pnpm --filter backend test:e2e
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
const email = (suffix: string) => `xtenant+${RUN}+${suffix}@example.com`;

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

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Cross-tenant isolation (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;

  // User A owns everything; user B is the attacker.
  let cookieA: string;
  let cookieB: string;
  let userIdA: string;
  let userIdB: string;

  let habitA: string;
  let recommendationA: string;
  let subscriptionA: string;

  const auth = (cookie: string) => ({ Cookie: `access_token=${cookie}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.use(cookieParser());
    await app.init();

    ds = app.get(DataSource);

    ({ accessCookie: cookieA, userId: userIdA } = await registerLoginAndGetCookie(app, 'a'));
    ({ accessCookie: cookieB, userId: userIdB } = await registerLoginAndGetCookie(app, 'b'));

    // User A's habit, plus a log so the analytics/calendar paths have data.
    const habitRes = await request(app.getHttpServer())
      .post('/habits')
      .set(auth(cookieA))
      .send({ name: 'Private habit of A', frequencyType: 'daily', difficulty: 2 })
      .expect(201);
    habitA = (habitRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .post(`/habits/${habitA}/log`)
      .set(auth(cookieA))
      .send({ date: todayStr(), status: 'completed' })
      .expect(201);

    // A recommendation for A. Recommendations are worker-generated, so insert
    // directly -- the point here is the read/mutate path, not generation.
    const recRows = await ds.query<Array<{ id: string }>>(
      `INSERT INTO recommendations (user_id, habit_id, source, category, title, body, priority)
       VALUES ($1, $2, 'rule', 'reschedule', 'A private title', 'A private body', 50)
       RETURNING id`,
      [userIdA, habitA],
    );
    recommendationA = recRows[0]!.id;

    // A push subscription for A.
    const subRes = await request(app.getHttpServer())
      .post('/notifications/subscriptions')
      .set(auth(cookieA))
      .send({
        endpoint: `https://push.example.com/${RUN}-a`,
        keys: { p256dh: 'BExampleKeyForUserA', auth: 'authSecretA' },
      });
    subscriptionA = (subRes.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('setup produced two distinct users and A owns the fixtures', () => {
    expect(userIdA).not.toBe(userIdB);
    expect(habitA).toBeDefined();
    expect(recommendationA).toBeDefined();
    expect(subscriptionA).toBeDefined();
  });

  // ─── Habits ────────────────────────────────────────────────────────────────

  describe("user B cannot reach user A's habit", () => {
    it('GET /habits/:id → 404', () =>
      request(app.getHttpServer()).get(`/habits/${habitA}`).set(auth(cookieB)).expect(404));

    it('PATCH /habits/:id → 404 and leaves the row untouched', async () => {
      await request(app.getHttpServer())
        .patch(`/habits/${habitA}`)
        .set(auth(cookieB))
        .send({ name: 'Renamed by B' })
        .expect(404);

      const rows = await ds.query<Array<{ name: string }>>(
        `SELECT name FROM habits WHERE id = $1`,
        [habitA],
      );
      expect(rows[0]?.name).toBe('Private habit of A');
    });

    it('DELETE /habits/:id → 404 and the habit survives', async () => {
      await request(app.getHttpServer())
        .delete(`/habits/${habitA}`)
        .set(auth(cookieB))
        .expect(404);

      const rows = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM habits WHERE id = $1 AND archived_at IS NULL`,
        [habitA],
      );
      expect(rows).toHaveLength(1);
    });

    it('POST /habits/:id/unarchive → 404', () =>
      request(app.getHttpServer())
        .post(`/habits/${habitA}/unarchive`)
        .set(auth(cookieB))
        .expect(404));

    it('POST /habits/:id/log → 404 and writes no log for B', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitA}/log`)
        .set(auth(cookieB))
        .send({ date: todayStr(), status: 'completed' })
        .expect(404);

      const rows = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM habit_logs WHERE habit_id = $1 AND user_id = $2`,
        [habitA, userIdB],
      );
      expect(rows).toHaveLength(0);
    });

    it("DELETE /habits/:id/log/:date → 404 and A's log survives", async () => {
      await request(app.getHttpServer())
        .delete(`/habits/${habitA}/log/${todayStr()}`)
        .set(auth(cookieB))
        .expect(404);

      const rows = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM habit_logs WHERE habit_id = $1 AND user_id = $2`,
        [habitA, userIdA],
      );
      expect(rows).toHaveLength(1);
    });

    // Edits a log note (FR-034), so the body is { note } -- sending anything else
    // is rejected as 400 by forbidNonWhitelisted before authorization is reached,
    // which would make this assertion pass for the wrong reason.
    it("PATCH /habits/:id/log/:date → 404 and A's note is unchanged", async () => {
      await request(app.getHttpServer())
        .patch(`/habits/${habitA}/log/${todayStr()}`)
        .set(auth(cookieB))
        .send({ note: 'Injected by B' })
        .expect(404);

      const rows = await ds.query<Array<{ note: string | null }>>(
        `SELECT note FROM habit_logs WHERE habit_id = $1 AND user_id = $2`,
        [habitA, userIdA],
      );
      expect(rows[0]?.note ?? null).not.toBe('Injected by B');
    });
  });

  // ─── Analytics ─────────────────────────────────────────────────────────────

  describe("user B cannot read user A's analytics", () => {
    it('GET /habits/:id/analytics → 404', () =>
      request(app.getHttpServer())
        .get(`/habits/${habitA}/analytics`)
        .set(auth(cookieB))
        .expect(404));

    it('GET /habits/:id/calendar → 404', () =>
      request(app.getHttpServer())
        .get(`/habits/${habitA}/calendar`)
        .query({ from: todayStr(), to: todayStr() })
        .set(auth(cookieB))
        .expect(404));
  });

  // ─── Recommendations ───────────────────────────────────────────────────────

  describe("user B cannot act on user A's recommendation", () => {
    it('POST /recommendations/:id/dismiss → 404 and status is unchanged', async () => {
      await request(app.getHttpServer())
        .post(`/recommendations/${recommendationA}/dismiss`)
        .set(auth(cookieB))
        .expect(404);

      const rows = await ds.query<Array<{ status: string }>>(
        `SELECT status FROM recommendations WHERE id = $1`,
        [recommendationA],
      );
      expect(rows[0]?.status).toBe('active');
    });

    it('POST /recommendations/:id/accept → 404 and status is unchanged', async () => {
      await request(app.getHttpServer())
        .post(`/recommendations/${recommendationA}/accept`)
        .set(auth(cookieB))
        .expect(404);

      const rows = await ds.query<Array<{ status: string }>>(
        `SELECT status FROM recommendations WHERE id = $1`,
        [recommendationA],
      );
      expect(rows[0]?.status).toBe('active');
    });

    it("GET /recommendations does not list A's recommendation for B", async () => {
      const res = await request(app.getHttpServer())
        .get('/recommendations')
        .set(auth(cookieB))
        .expect(200);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain(recommendationA);
      expect(body).not.toContain('A private title');
    });
  });

  // ─── Notifications ─────────────────────────────────────────────────────────

  describe("user B cannot delete user A's push subscription", () => {
    it('DELETE /notifications/subscriptions/:id → 404 and the row survives', async () => {
      await request(app.getHttpServer())
        .delete(`/notifications/subscriptions/${subscriptionA}`)
        .set(auth(cookieB))
        .expect(404);

      const rows = await ds.query<Array<{ id: string }>>(
        `SELECT id FROM push_subscriptions WHERE id = $1`,
        [subscriptionA],
      );
      expect(rows).toHaveLength(1);
    });
  });

  // ─── Collection endpoints ──────────────────────────────────────────────────

  describe("collection endpoints never spill another tenant's rows", () => {
    it("GET /habits shows B nothing of A's", async () => {
      const res = await request(app.getHttpServer())
        .get('/habits')
        .set(auth(cookieB))
        .expect(200);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain(habitA);
      expect(body).not.toContain('Private habit of A');
    });

    it("GET /dashboard shows B nothing of A's", async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set(auth(cookieB))
        .expect(200);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain(habitA);
      expect(body).not.toContain('Private habit of A');
    });

    it("GET /coach/chat/history shows B nothing of A's", async () => {
      await request(app.getHttpServer())
        .post('/coach/chat')
        .set(auth(cookieA))
        .send({ message: 'A private chat message' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/coach/chat/history')
        .set(auth(cookieB))
        .expect(200);

      expect(JSON.stringify(res.body)).not.toContain('A private chat message');
    });
  });

  // ─── Auth context integrity ────────────────────────────────────────────────

  describe('user id comes from the token, not the request', () => {
    it('a body-supplied userId cannot redirect a write to another tenant', async () => {
      // `forbidNonWhitelisted` should reject the unknown property outright; if it
      // is ever relaxed, the habit must still land on B rather than on A.
      const res = await request(app.getHttpServer())
        .post('/habits')
        .set(auth(cookieB))
        .send({
          name: 'Injected owner attempt',
          frequencyType: 'daily',
          difficulty: 1,
          userId: userIdA,
        });

      expect([400, 201]).toContain(res.status);

      if (res.status === 201) {
        const id = (res.body as { id: string }).id;
        const rows = await ds.query<Array<{ user_id: string }>>(
          `SELECT user_id FROM habits WHERE id = $1`,
          [id],
        );
        expect(rows[0]?.user_id).toBe(userIdB);
      }
    });

    it('requests with no access token are rejected', () =>
      request(app.getHttpServer()).get(`/habits/${habitA}`).expect(401));
  });
});
