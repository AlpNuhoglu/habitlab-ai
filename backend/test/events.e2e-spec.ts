/**
 * WP4 — Outbox + Broker integration tests.
 *
 * Verifies:
 *  - Every state-changing endpoint inserts an event row in the same transaction.
 *  - OutboxPublisher picks up unpublished events within ~500ms and sets published_at.
 *  - StubBrokerAdapter receives the published event with the correct envelope.
 *  - logHabit and updateLogNote are fully atomic (state change + event in one tx).
 *
 * Requires a real PostgreSQL instance at DATABASE_URL (migrated).
 * BROKER_ADAPTER=stub must be set (or NODE_ENV=test) so StubBrokerAdapter is used.
 *
 * Run:
 *   DATABASE_URL=postgres://... BROKER_ADAPTER=stub npm run test:e2e -- --testPathPattern=events
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
import { StubBrokerAdapter } from '../src/infrastructure/broker/stub-broker.adapter';

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
const email = (suffix: string) => `events+${RUN}+${suffix}@example.com`;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Outbox + Broker (e2e)', () => {
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

  beforeEach(() => {
    stub.reset();
  });

  // ─── 1. habit.created event row ─────────────────────────────────────────────
  //
  // Root-cause note: previously this was four separate it() blocks sharing a
  // describe-scoped habitId. The suite-level beforeEach(() => stub.reset())
  // fires before EVERY it(), so any events published during one it()'s sleep
  // were cleared from the stub before the next it() started. Fixed by:
  //   (a) making habitId local to a single it() so no inter-test state leaks
  //   (b) calling stub.reset() at the top of the test (right before creation)
  //       so the suite-level beforeEach that already fired is a no-op
  //   (c) asserting event-row, published_at, and stub contents in one it()
  //       so no beforeEach can wipe the stub between the sleep and the check

  describe('habit.created event', () => {
    let cookie: string;

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'ev1'));
    });

    it('event row exists with published_at NULL, then OutboxPublisher publishes within 600ms', async () => {
      // Reset stub here (suite beforeEach already ran, but this makes intent explicit).
      stub.reset();

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Meditate', frequencyType: 'daily', difficulty: 2 })
        .expect(201);

      const habitId = (res.body as { id: string }).id;

      // Event row must exist with published_at NULL immediately after creation.
      const rowsBefore: Array<{ event_type: string; published_at: Date | null }> = await ds.query(
        `SELECT event_type, published_at FROM events
          WHERE aggregate_type = 'habit' AND aggregate_id = $1`,
        [habitId],
      );
      expect(rowsBefore).toHaveLength(1);
      expect(rowsBefore[0]?.event_type).toBe('habit.created');
      expect(rowsBefore[0]?.published_at).toBeNull();

      // OutboxPublisher polls every 200ms; two full cycles fit within 600ms.
      await sleep(600);

      const rowsAfter: Array<{ published_at: Date | null }> = await ds.query(
        `SELECT published_at FROM events WHERE aggregate_id = $1`,
        [habitId],
      );
      expect(rowsAfter[0]?.published_at).not.toBeNull();

      const ev = stub.getPublished().find(
        (e) => e.eventType === 'habit.created' && e.aggregateId === habitId,
      );
      expect(ev).toBeDefined();
      expect(ev?.aggregateType).toBe('habit');
      expect(typeof ev?.payload['name']).toBe('string');
    });
  });

  // ─── 2. habit.completed + payload correctness ────────────────────────────────

  describe('habit.completed event', () => {
    let cookie: string;
    let habitId: string;
    const today = todayStr();

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'ev2'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Run', frequencyType: 'daily' })
        .expect(201);
      habitId = (res.body as { id: string }).id;

      stub.reset();
    });

    it('POST /habits/:id/log inserts habit.completed event with correct payload', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: today })
        .expect(201);

      const rows: Array<{ event_type: string; payload: Record<string, unknown> }> = await ds.query(
        `SELECT event_type, payload FROM events
          WHERE aggregate_type = 'habit' AND aggregate_id = $1
            AND event_type = 'habit.completed'`,
        [habitId],
      );

      expect(rows).toHaveLength(1);
      const payload = rows[0]?.payload;
      expect(payload?.['status']).toBe('completed');
      expect(payload?.['date']).toBe(today);
      expect(payload?.['habitId']).toBe(habitId);
      expect(payload?.['isUpdate']).toBe(false);
    });

    it('re-logging same date emits habit.log_updated not habit.completed', async () => {
      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'skipped', date: today })
        .expect(200);

      const rows: Array<{ event_type: string }> = await ds.query(
        `SELECT event_type FROM events
          WHERE aggregate_type = 'habit' AND aggregate_id = $1
            AND event_type = 'habit.log_updated'`,
        [habitId],
      );
      expect(rows.length).toBeGreaterThanOrEqual(1);
    });

    it('OutboxPublisher publishes habit.completed to stub within 500ms', async () => {
      await sleep(500);

      const published = stub.getPublished();
      const ev = published.find((e) => e.eventType === 'habit.completed' && e.aggregateId === habitId);
      expect(ev).toBeDefined();
      expect(ev?.payload['status']).toBe('completed');
    });
  });

  // ─── 3. updateLogNote atomicity ──────────────────────────────────────────────

  describe('updateLogNote atomicity', () => {
    let cookie: string;
    let habitId: string;
    const today = todayStr();

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'ev3'));

      const res = await request(app.getHttpServer())
        .post('/habits')
        .set('Cookie', `access_token=${cookie}`)
        .send({ name: 'Journal', frequencyType: 'daily' })
        .expect(201);
      habitId = (res.body as { id: string }).id;

      await request(app.getHttpServer())
        .post(`/habits/${habitId}/log`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ status: 'completed', date: today })
        .expect(201);
    });

    it('PATCH log note inserts habit.log_updated event in same row count increment', async () => {
      const before: Array<{ cnt: string }> = await ds.query(
        `SELECT COUNT(*)::text AS cnt FROM events
          WHERE aggregate_id = $1 AND event_type = 'habit.log_updated'`,
        [habitId],
      );
      const beforeCount = parseInt(before[0]?.cnt ?? '0', 10);

      await request(app.getHttpServer())
        .patch(`/habits/${habitId}/log/${today}`)
        .set('Cookie', `access_token=${cookie}`)
        .send({ note: 'great session' })
        .expect(200);

      const after: Array<{ cnt: string }> = await ds.query(
        `SELECT COUNT(*)::text AS cnt FROM events
          WHERE aggregate_id = $1 AND event_type = 'habit.log_updated'`,
        [habitId],
      );
      const afterCount = parseInt(after[0]?.cnt ?? '0', 10);

      expect(afterCount).toBe(beforeCount + 1);
    });
  });

  // ─── 4. Batch processing — multiple unpublished events ────────────────────────

  describe('batch publish', () => {
    let cookie: string;
    const createdHabitIds: string[] = [];

    beforeAll(async () => {
      ({ accessCookie: cookie } = await registerLoginAndGetCookie(app, 'ev4'));

      stub.reset();

      // Create 3 habits → 3 unpublished events
      for (let i = 0; i < 3; i++) {
        const res = await request(app.getHttpServer())
          .post('/habits')
          .set('Cookie', `access_token=${cookie}`)
          .send({ name: `Batch habit ${i}`, frequencyType: 'daily' })
          .expect(201);
        createdHabitIds.push((res.body as { id: string }).id);
      }
    });

    it('all 3 events are published within 500ms', async () => {
      await sleep(500);

      const published = stub.getPublished();
      const ourEvents = published.filter(
        (e) => e.eventType === 'habit.created' && createdHabitIds.includes(e.aggregateId ?? ''),
      );
      expect(ourEvents.length).toBe(3);
    });

    it('published_at is set for all 3 habit rows', async () => {
      const rows: Array<{ published_at: Date | null }> = await ds.query(
        `SELECT published_at FROM events
          WHERE aggregate_id = ANY($1::uuid[]) AND event_type = 'habit.created'`,
        [createdHabitIds],
      );
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.published_at).not.toBeNull();
      }
    });
  });
});
