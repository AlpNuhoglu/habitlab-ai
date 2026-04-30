/**
 * A/B testing subsystem integration tests (WP8, FR-070..FR-074).
 *
 * Requires a real PostgreSQL instance at DATABASE_URL, freshly migrated.
 * Cache is always a MISS in tests (NullCacheAdapter via NODE_ENV=test).
 * AssignmentService is tested both directly and via HTTP.
 *
 * Run locally:
 *   DATABASE_URL=postgres://... npm run test:e2e -- --testPathPattern=experiments
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
import { AssignmentService } from '../src/modules/experiments/assignment.service';
import { RecommendationWorkerService } from '../src/modules/recommendations/recommendation-worker.service';

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
const email = (suffix: string) => `exp+${RUN}+${suffix}@example.com`;

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

function daysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ExperimentRow {
  id: string;
  key: string;
  status: string;
}

interface AssignmentRow {
  user_id: string;
  experiment_id: string;
  variant_key: string;
}

/** Seed a minimal running experiment; returns its id. */
async function seedRunningExperiment(ds: DataSource, key: string): Promise<string> {
  const rows = await ds.query<ExperimentRow[]>(
    `INSERT INTO experiments (key, name, variants, primary_metric, status)
     VALUES ($1, $2, $3::jsonb, 'completion_rate_7d', 'running')
     ON CONFLICT (key) DO UPDATE SET status = 'running'
     RETURNING id, key, status`,
    [
      key,
      `Test experiment ${key}`,
      JSON.stringify([
        { key: 'control', weight: 50 },
        { key: 'treatment', weight: 50 },
      ]),
    ],
  );
  return rows[0]!.id;
}

async function drainEventsToWorkers(app: INestApplication, stub: StubBrokerAdapter): Promise<void> {
  await sleep(400);
  const analyticsWorker = app.get(AnalyticsWorkerService);
  const recWorker = app.get(RecommendationWorkerService);
  const events = stub.getPublished();
  stub.reset();
  for (const event of events) {
    await analyticsWorker.handleEvent(event);
  }
  for (const event of events) {
    await recWorker.handleEvent(event);
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('A/B testing subsystem (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let stub: StubBrokerAdapter;
  let assignmentService: AssignmentService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.use(cookieParser());
    await app.init();

    ds = app.get(DataSource);
    stub = app.get(BROKER_ADAPTER) as StubBrokerAdapter;
    assignmentService = app.get(AssignmentService);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── FR-071: Deterministic assignment ──────────────────────────────────────

  describe('deterministic variant assignment (FR-071)', () => {
    it('returns the same variant on repeated calls for the same (userId, experimentKey)', async () => {
      const { userId } = await registerLoginAndGetCookie(app, 'det1');
      await seedRunningExperiment(ds, 'det_test_v1');

      const v1 = await assignmentService.getOrAssign(userId, 'det_test_v1');
      const v2 = await assignmentService.getOrAssign(userId, 'det_test_v1');
      const v3 = await assignmentService.getOrAssign(userId, 'det_test_v1');

      expect(v1).toBe(v2);
      expect(v2).toBe(v3);
      expect(['control', 'treatment']).toContain(v1);
    });

    it('persists assignment to experiment_assignments table on first call', async () => {
      const { userId } = await registerLoginAndGetCookie(app, 'det2');
      const experimentId = await seedRunningExperiment(ds, 'det_persist_v1');

      await assignmentService.getOrAssign(userId, 'det_persist_v1');

      const rows = await ds.query<AssignmentRow[]>(
        `SELECT * FROM experiment_assignments WHERE user_id = $1 AND experiment_id = $2`,
        [userId, experimentId],
      );
      expect(rows).toHaveLength(1);
      expect(['control', 'treatment']).toContain(rows[0]!.variant_key);
    });

    it('returns "control" and does NOT write an assignment when experiment is not running', async () => {
      const { userId } = await registerLoginAndGetCookie(app, 'det3');

      // seed a draft experiment
      const rows = await ds.query<ExperimentRow[]>(
        `INSERT INTO experiments (key, name, variants, primary_metric, status)
         VALUES ('draft_exp_v1', 'Draft experiment', $1::jsonb, 'completion_rate_7d', 'draft')
         ON CONFLICT (key) DO UPDATE SET status = 'draft'
         RETURNING id`,
        [
          JSON.stringify([
            { key: 'control', weight: 50 },
            { key: 'treatment', weight: 50 },
          ]),
        ],
      );
      const experimentId = rows[0]!.id;

      const variant = await assignmentService.getOrAssign(userId, 'draft_exp_v1');
      expect(variant).toBe('control');

      const assignments = await ds.query<AssignmentRow[]>(
        `SELECT * FROM experiment_assignments WHERE user_id = $1 AND experiment_id = $2`,
        [userId, experimentId],
      );
      expect(assignments).toHaveLength(0);
    });
  });

  // ─── FR-073: Opt-out ────────────────────────────────────────────────────────

  describe('experiment opt-out (FR-073)', () => {
    it('returns control and does NOT write assignment when user has opted out', async () => {
      const { userId, accessCookie } = await registerLoginAndGetCookie(app, 'optout1');
      const experimentId = await seedRunningExperiment(ds, 'optout_test_v1');

      // Opt the user out
      await request(app.getHttpServer())
        .patch('/me')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ experimentsOptedOut: true })
        .expect(200);

      const variant = await assignmentService.getOrAssign(userId, 'optout_test_v1');
      expect(variant).toBe('control');

      const assignments = await ds.query<AssignmentRow[]>(
        `SELECT * FROM experiment_assignments WHERE user_id = $1 AND experiment_id = $2`,
        [userId, experimentId],
      );
      expect(assignments).toHaveLength(0);
    });
  });

  // ─── FR-072: Variant delivery endpoint ─────────────────────────────────────

  describe('GET /experiments/variant (FR-072)', () => {
    it('returns 200 with variant map for running experiment', async () => {
      const { userId: _userId, accessCookie } = await registerLoginAndGetCookie(app, 'http1');
      await seedRunningExperiment(ds, 'http_test_v1');

      const res = await request(app.getHttpServer())
        .get('/experiments/variant')
        .query({ keys: 'http_test_v1' })
        .set('Cookie', [`access_token=${accessCookie}`])
        .expect(200);

      const body = res.body as Record<string, string>;
      expect(body['http_test_v1']).toBeDefined();
      expect(['control', 'treatment']).toContain(body['http_test_v1']);
    });

    it('returns "control" for an unknown experiment key', async () => {
      const { accessCookie } = await registerLoginAndGetCookie(app, 'http2');

      const res = await request(app.getHttpServer())
        .get('/experiments/variant')
        .query({ keys: 'nonexistent_exp_v1' })
        .set('Cookie', [`access_token=${accessCookie}`])
        .expect(200);

      const body = res.body as Record<string, string>;
      expect(body['nonexistent_exp_v1']).toBe('control');
    });

    it('resolves multiple keys in one request', async () => {
      const { accessCookie } = await registerLoginAndGetCookie(app, 'http3');
      await seedRunningExperiment(ds, 'multi_a_v1');
      await seedRunningExperiment(ds, 'multi_b_v1');

      const res = await request(app.getHttpServer())
        .get('/experiments/variant')
        .query({ keys: 'multi_a_v1,multi_b_v1' })
        .set('Cookie', [`access_token=${accessCookie}`])
        .expect(200);

      const body = res.body as Record<string, string>;
      expect(body['multi_a_v1']).toBeDefined();
      expect(body['multi_b_v1']).toBeDefined();
    });

    it('returns 400 when keys param is missing', async () => {
      const { accessCookie } = await registerLoginAndGetCookie(app, 'http4');
      await request(app.getHttpServer())
        .get('/experiments/variant')
        .set('Cookie', [`access_token=${accessCookie}`])
        .expect(400);
    });

    it('returns 401 without auth cookie', async () => {
      await request(app.getHttpServer())
        .get('/experiments/variant')
        .query({ keys: 'http_test_v1' })
        .expect(401);
    });
  });

  // ─── §6.5.2: Exposure event emission ───────────────────────────────────────

  describe('experiment.exposure event (§6.5.2)', () => {
    it('emits an experiment.exposure event after GET /experiments/variant', async () => {
      const { userId, accessCookie } = await registerLoginAndGetCookie(app, 'exp1');
      await seedRunningExperiment(ds, 'exposure_test_v1');

      await request(app.getHttpServer())
        .get('/experiments/variant')
        .query({ keys: 'exposure_test_v1' })
        .set('Cookie', [`access_token=${accessCookie}`])
        .expect(200);

      // Give the fire-and-forget INSERT a moment to land (controller is non-blocking)
      await sleep(500);

      const events = await ds.query<
        Array<{ event_type: string; payload: Record<string, unknown> }>
      >(
        `SELECT event_type, payload FROM events
         WHERE user_id = $1 AND event_type = 'experiment.exposure'
         ORDER BY occurred_at DESC LIMIT 1`,
        [userId],
      );

      expect(events).toHaveLength(1);
      expect(events[0]!.payload['experimentKey']).toBe('exposure_test_v1');
    });
  });

  // ─── §6.5.3: Analysis SQL ───────────────────────────────────────────────────

  describe('analysis SQL (§6.5.3)', () => {
    it('returns per-variant retention counts from fixture data', async () => {
      const expKey = `analysis_test_${RUN}`;

      // Seed the experiment
      await ds.query(
        `INSERT INTO experiments (key, name, variants, primary_metric, status)
         VALUES ($1, 'Analysis test', $2::jsonb, 'completion_rate_7d', 'running')`,
        [
          expKey,
          JSON.stringify([
            { key: 'control', weight: 50 },
            { key: 'treatment', weight: 50 },
          ]),
        ],
      );

      // Seed two users with known exposure and retention
      const [u1, u2] = await Promise.all([
        registerLoginAndGetCookie(app, `anal_u1`),
        registerLoginAndGetCookie(app, `anal_u2`),
      ]);
      const userId1 = u1.userId;
      const userId2 = u2.userId;

      const exposedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      // Insert exposure events directly
      await ds.query(
        `INSERT INTO events (user_id, event_type, aggregate_type, payload, occurred_at)
         VALUES
           ($1, 'experiment.exposure', 'experiment', $3::jsonb, $5),
           ($2, 'experiment.exposure', 'experiment', $4::jsonb, $5)`,
        [
          userId1,
          userId2,
          JSON.stringify({ experimentKey: expKey, variantKey: 'control' }),
          JSON.stringify({ experimentKey: expKey, variantKey: 'treatment' }),
          exposedAt.toISOString(),
        ],
      );

      // User1 (control) completed a habit 7 days after exposure → retained
      const habitLogDate = new Date(exposedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      const logDateStr = habitLogDate.toISOString().slice(0, 10);

      // Get a habit for user1 (create one first)
      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${u1.accessCookie}`])
        .send({ name: 'Analysis habit', frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      await ds.query(
        `INSERT INTO habit_logs (habit_id, user_id, log_date, status)
         VALUES ($1, $2, $3, 'completed')
         ON CONFLICT DO NOTHING`,
        [habitId, userId1, logDateStr],
      );

      // User2 (treatment) was not retained — no log

      // Run the analysis SQL
      const rows = await ds.query<
        Array<{ variant: string; n: string; retained_n: string; retention_rate: string }>
      >(
        `WITH exposure AS (
           SELECT e.user_id,
                  (e.payload->>'variantKey') AS variant,
                  MIN(e.occurred_at) AS first_exposure_at
           FROM events e
           WHERE e.event_type = 'experiment.exposure'
             AND e.payload->>'experimentKey' = $1
           GROUP BY e.user_id, (e.payload->>'variantKey')
         ),
         retained AS (
           SELECT exp.user_id,
                  exp.variant,
                  EXISTS (
                    SELECT 1 FROM habit_logs hl
                    WHERE hl.user_id = exp.user_id
                      AND hl.status = 'completed'
                      AND hl.log_date BETWEEN (exp.first_exposure_at::date + 6)
                                          AND (exp.first_exposure_at::date + 8)
                  ) AS is_retained
           FROM exposure exp
           WHERE exp.first_exposure_at < now() - interval '8 days'
         )
         SELECT variant,
                COUNT(*) AS n,
                SUM(CASE WHEN is_retained THEN 1 ELSE 0 END) AS retained_n,
                ROUND(SUM(CASE WHEN is_retained THEN 1 ELSE 0 END)::numeric / COUNT(*), 4) AS retention_rate
         FROM retained
         GROUP BY variant
         ORDER BY variant`,
        [expKey],
      );

      expect(rows).toHaveLength(2);

      const control = rows.find((r) => r.variant === 'control');
      const treatment = rows.find((r) => r.variant === 'treatment');

      expect(control).toBeDefined();
      expect(treatment).toBeDefined();
      expect(parseInt(control!.n, 10)).toBe(1);
      expect(parseInt(control!.retained_n, 10)).toBe(1);
      expect(parseInt(treatment!.n, 10)).toBe(1);
      expect(parseInt(treatment!.retained_n, 10)).toBe(0);
    });
  });

  // ─── WP8 recommendation worker integration ──────────────────────────────────

  describe('recommendation worker sets experimentVariant (WP8)', () => {
    it('populates experiment_variant on recommendations when experiment is running', async () => {
      const { userId, accessCookie } = await registerLoginAndGetCookie(app, 'recwp8');
      await seedRunningExperiment(ds, 'rec_copy_v1');

      // Create a habit and log it many times to trigger reduce_difficulty rule
      const habitRes = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ name: 'Hard habit', frequencyType: 'daily', difficulty: 5 })
        .expect(201);
      const habitId = (habitRes.body as { id: string }).id;

      // Log as skipped for 30 days to trigger rule (rate30d < 0.4, difficulty >= 3)
      for (let i = 1; i <= 30; i++) {
        await ds.query(
          `INSERT INTO habit_logs (habit_id, user_id, log_date, status)
           VALUES ($1, $2, $3, 'skipped')
           ON CONFLICT DO NOTHING`,
          [habitId, userId, daysAgo(i)],
        );
      }

      // Trigger analytics + recommendation workers
      const logRes = await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', [`access_token=${accessCookie}`])
        .send({ date: daysAgo(0), status: 'skipped' })
        .expect(201);
      void logRes;

      await drainEventsToWorkers(app, stub);

      const recs = await ds.query<Array<{ experiment_variant: string | null }>>(
        `SELECT experiment_variant FROM recommendations WHERE user_id = $1`,
        [userId],
      );

      // At least one recommendation should have experiment_variant set
      expect(recs.some((r) => r.experiment_variant !== null)).toBe(true);
    });
  });
});
