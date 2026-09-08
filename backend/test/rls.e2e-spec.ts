/**
 * Row level security enforcement (NFR-038).
 *
 * cross-tenant.e2e-spec.ts attacks the HTTP surface and passes whether
 * isolation comes from the application's `WHERE user_id` filters or from the
 * database. That makes it unable to tell a working policy from an inert one.
 *
 * This suite closes that gap. It goes under HTTP and issues queries the
 * application would never write — unscoped selects, writes attributed to
 * another user, reads with no tenant at all — so a passing run means the
 * database itself is refusing, not the repositories.
 *
 * Requires a real PostgreSQL instance at DATABASE_URL, freshly migrated, with
 * APP_DATABASE_URL pointing at the de-privileged habitlab_app role.
 */

import { randomUUID } from 'crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { runAsTenant } from '../src/infrastructure/database/tenant-context';
import { AnalyticsWorkerService } from '../src/modules/analytics/analytics-worker.service';
import { RecommendationWorkerService } from '../src/modules/recommendations/recommendation-worker.service';
import { privilegedDataSource } from './helpers/privileged-datasource';

const RUN = Date.now();
const email = (suffix: string) => `rls+${RUN}+${suffix}@example.com`;

function getCookies(res: { headers: Record<string, unknown> }): string[] {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') return [raw];
  return [];
}

async function registerAndLogin(
  app: INestApplication,
  suffix: string,
): Promise<{ cookie: string; userId: string }> {
  const reg = await request(app.getHttpServer())
    .post('/auth/register')
    .send({
      email: email(suffix),
      password: 'Password1',
      timezone: 'UTC',
      locale: 'en',
      consentGiven: true,
    })
    .expect(202);

  const userId = (reg.body as { userId: string }).userId;
  const secret = app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET');
  const verifyToken = jwt.sign({ sub: userId, purpose: 'email_verify' }, secret, {
    expiresIn: '24h',
  });
  await request(app.getHttpServer()).get('/auth/verify').query({ token: verifyToken }).expect(200);

  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: email(suffix), password: 'Password1' })
    .expect(200);

  const cookie = getCookies(login)
    .find((c) => c.startsWith('access_token='))
    ?.split(';')[0]
    ?.slice('access_token='.length);
  if (!cookie) throw new Error('No access_token cookie after login');

  return { cookie, userId };
}

describe('Row level security (e2e)', () => {
  let app: INestApplication;
  let appDs: DataSource; // RLS-bound: what the application uses.
  let privDs: DataSource; // Privileged: fixtures and cross-tenant assertions.

  let userIdA: string;
  let userIdB: string;
  let habitA: string;
  let habitB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.use(cookieParser());
    await app.init();

    appDs = app.get(DataSource);
    privDs = privilegedDataSource(app);

    const a = await registerAndLogin(app, 'a');
    const b = await registerAndLogin(app, 'b');
    userIdA = a.userId;
    userIdB = b.userId;

    const mk = async (cookie: string, name: string): Promise<string> => {
      const res = await request(app.getHttpServer())
        .post('/habits')
        .set({ Cookie: `access_token=${cookie}` })
        .send({ name, frequencyType: 'daily', difficulty: 2 })
        .expect(201);
      return (res.body as { id: string }).id;
    };

    habitA = await mk(a.cookie, 'Habit of A');
    habitB = await mk(b.cookie, 'Habit of B');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('the application pool cannot bypass policy', () => {
    it('connects as a role that is neither superuser nor BYPASSRLS', async () => {
      const rows = await appDs.query<Array<{ rolsuper: boolean; rolbypassrls: boolean }>>(
        `SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
      );
      expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
    });
  });

  describe('negative control: the database filters, not the query', () => {
    // The reason this whole work package exists. The query below is exactly the
    // mistake RLS is meant to survive — a select over a user-owned table with no
    // user_id predicate at all. With policies inert it returns every tenant's
    // rows; with policies working it returns one tenant's.
    it('an unscoped SELECT returns only the tenant in context', async () => {
      const rows = await runAsTenant(userIdB, () =>
        appDs.query<Array<{ id: string; user_id: string }>>(`SELECT id, user_id FROM habits`),
      );

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((r) => r.id)).toContain(habitB);
      expect(rows.map((r) => r.id)).not.toContain(habitA);
      expect([...new Set(rows.map((r) => r.user_id))]).toEqual([userIdB]);
    });

    it('an unscoped UPDATE cannot reach another tenant', async () => {
      await runAsTenant(userIdB, () =>
        appDs.query(`UPDATE habits SET name = 'renamed by B'`),
      );

      const [row] = await privDs.query<Array<{ name: string }>>(
        `SELECT name FROM habits WHERE id = $1`,
        [habitA],
      );
      expect(row?.name).toBe('Habit of A');
    });

    it('an unscoped DELETE cannot reach another tenant', async () => {
      await runAsTenant(userIdB, () => appDs.query(`DELETE FROM habit_logs`));

      const [row] = await privDs.query<Array<{ id: string }>>(
        `SELECT id FROM habits WHERE id = $1`,
        [habitA],
      );
      expect(row?.id).toBe(habitA);
    });
  });

  describe('fail closed', () => {
    it('returns zero rows when no tenant is in context', async () => {
      // Never "all rows". A forgotten context must look like absence, not access.
      const rows = await appDs.query<unknown[]>(`SELECT id FROM habits`);
      expect(rows).toHaveLength(0);
    });

    it('an empty tenant resolves to NULL rather than raising', async () => {
      const [row] = await appDs.query<Array<{ ok: boolean }>>(
        `SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid IS NULL AS ok`,
      );
      expect(row?.ok).toBe(true);
    });
  });

  describe('WITH CHECK blocks writes attributed to another tenant', () => {
    it('rejects an INSERT that claims another user_id', async () => {
      await expect(
        runAsTenant(userIdB, () =>
          appDs.query(
            `INSERT INTO habits (user_id, name, frequency_type, difficulty)
             VALUES ($1, 'forged', 'daily', 1)`,
            [userIdA],
          ),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it('rejects reassigning one of your rows to another tenant', async () => {
      await expect(
        runAsTenant(userIdB, () =>
          appDs.query(`UPDATE habits SET user_id = $1 WHERE id = $2`, [userIdA, habitB]),
        ),
      ).rejects.toThrow(/row-level security/i);
    });
  });

  describe('tables held by grant rather than by policy', () => {
    it('refresh_tokens is unreachable from the application pool', async () => {
      // Excluded from RLS on purpose: /auth/refresh is public, so no tenant is
      // in context, and reuse detection reads without a user_id (FR-004).
      // Withholding the grant is the stronger control.
      await expect(appDs.query(`SELECT id FROM refresh_tokens`)).rejects.toThrow(
        /permission denied/i,
      );
    });

    it('audit_log is append-only from the application pool', async () => {
      await expect(appDs.query(`SELECT id FROM audit_log`)).rejects.toThrow(/permission denied/i);
    });
  });

  describe('partitioned events', () => {
    const future = new Date(Date.now() + 400 * 24 * 60 * 60 * 1000);

    it('covers partitions created after the policies were enabled', async () => {
      await privDs.query(`SELECT ensure_events_partition($1::timestamptz)`, [future.toISOString()]);
      await privDs.query(
        `INSERT INTO events (user_id, event_type, aggregate_type, occurred_at)
         VALUES ($1, 'rls.test', 'test', $2)`,
        [userIdA, future.toISOString()],
      );

      const asB = await runAsTenant(userIdB, () =>
        appDs.query<unknown[]>(`SELECT id FROM events WHERE occurred_at = $1`, [
          future.toISOString(),
        ]),
      );
      expect(asB).toHaveLength(0);

      const asA = await runAsTenant(userIdA, () =>
        appDs.query<unknown[]>(`SELECT id FROM events WHERE occurred_at = $1`, [
          future.toISOString(),
        ]),
      );
      expect(asA).toHaveLength(1);
    });

    it('denies direct access to a partition', async () => {
      // Partitions carry no policy of their own — enforcement happens at the
      // parent. What stops a direct read is the absence of a grant, since GRANT
      // on a partitioned parent does not cascade to its children.
      const name = `events_${future.getUTCFullYear()}_${String(future.getUTCMonth() + 1).padStart(2, '0')}`;
      await expect(
        runAsTenant(userIdA, () => appDs.query(`SELECT id FROM ${name}`)),
      ).rejects.toThrow(/permission denied/i);
    });

    it('lets the de-privileged role create partitions via SECURITY DEFINER', async () => {
      // ensure_events_partition runs CREATE TABLE, which habitlab_app cannot do
      // directly. If this regresses, OutboxPublisher swallows the error and
      // coverage runs out silently a month later — this is the only place it
      // would surface.
      await expect(
        appDs.query(`SELECT ensure_events_partition(now() + interval '18 months')`),
      ).resolves.toBeDefined();
    });
  });

  describe('the privileged pool still crosses tenants', () => {
    // Positive control for the _privileged_bypass policies. Without them, FORCE
    // would leave the owner matching no policy at all — zero rows — and every
    // worker would break in a way that looks like missing data, not an error.
    it('reads rows belonging to more than one tenant', async () => {
      const rows = await privDs.query<Array<{ id: string }>>(
        `SELECT id FROM habits WHERE id = ANY($1::uuid[])`,
        [[habitA, habitB]],
      );
      expect(rows.map((r) => r.id).sort()).toEqual([habitA, habitB].sort());
    });
  });

  describe('workers are confined to the tenant on the event', () => {
    // The analytics and recommendation workers run on the application pool and
    // establish the tenant from event.userId. A forged event — B's userId
    // pointing at A's habit — is the shape that would cross tenants if the
    // worker were still privileged: the habit lookups filter on user_id, so
    // nothing matches, and the policy backs that up on every write it attempts.
    it('does not write analytics for a habit belonging to another tenant', async () => {
      const worker = app.get(AnalyticsWorkerService);

      await worker.handleEvent({
        id: randomUUID(),
        userId: userIdB,
        eventType: 'habit.completed',
        aggregateType: 'habit',
        aggregateId: habitA,
        payload: {},
        occurredAt: new Date(),
      });

      // Read privileged: the assertion is about what reached the table, not
      // about what this connection is allowed to see.
      const rows = await privDs.query<Array<{ user_id: string }>>(
        `SELECT user_id FROM habit_analytics WHERE habit_id = $1`,
        [habitA],
      );
      expect(rows.every((r) => r.user_id !== userIdB)).toBe(true);
    });

    it('does not write recommendations for a habit belonging to another tenant', async () => {
      const worker = app.get(RecommendationWorkerService);
      const before = await privDs.query<Array<{ id: string }>>(
        `SELECT id FROM recommendations WHERE habit_id = $1`,
        [habitA],
      );

      await worker.handleEvent({
        id: randomUUID(),
        userId: userIdB,
        eventType: 'habit.completed',
        aggregateType: 'habit',
        aggregateId: habitA,
        payload: {},
        occurredAt: new Date(),
      });

      const after = await privDs.query<Array<{ id: string; user_id: string }>>(
        `SELECT id, user_id FROM recommendations WHERE habit_id = $1`,
        [habitA],
      );
      expect(after).toHaveLength(before.length);
      expect(after.every((r) => r.user_id !== userIdB)).toBe(true);
    });

    // The two tests above assert the outcome, which the worker's own user_id
    // filters are enough to produce — they pass even with the policy disabled.
    // This one asserts the mechanism: the database refusing a write the worker
    // could otherwise make, now that it runs on the application pool.
    it('cannot write habit_analytics attributed to another tenant', async () => {
      await expect(
        runAsTenant(userIdB, () =>
          appDs.query(
            `INSERT INTO habit_analytics (habit_id, user_id, current_streak, longest_streak)
             VALUES ($1, $2, 0, 0)`,
            [habitA, userIdA],
          ),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    // Positive control: the same worker, given a truthful event, still works.
    // Without this, the two tests above would pass just as well if handleEvent
    // silently did nothing at all.
    it('still writes analytics when the event names the habit owner', async () => {
      const worker = app.get(AnalyticsWorkerService);

      await worker.handleEvent({
        id: randomUUID(),
        userId: userIdA,
        eventType: 'habit.completed',
        aggregateType: 'habit',
        aggregateId: habitA,
        payload: {},
        occurredAt: new Date(),
      });

      const rows = await privDs.query<Array<{ user_id: string }>>(
        `SELECT user_id FROM habit_analytics WHERE habit_id = $1`,
        [habitA],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]!.user_id).toBe(userIdA);
    });
  });

  describe('pooled connections do not leak tenant context', () => {
    // The failure mode the RlsClient design exists to prevent: a connection
    // returned to the pool still carrying the previous borrower's identity.
    // 60 interleaved queries over a small pool forces heavy reuse.
    it('keeps each concurrent query on its own tenant', async () => {
      const expected = [
        { userId: userIdA, habit: habitA },
        { userId: userIdB, habit: habitB },
      ];

      const results = await Promise.all(
        Array.from({ length: 60 }, (_, i) => {
          const { userId, habit } = expected[i % 2]!;
          return runAsTenant(userId, async () => {
            const rows = await appDs.query<Array<{ id: string; user_id: string }>>(
              `SELECT id, user_id FROM habits`,
            );
            return rows.every((r) => r.user_id === userId) && rows.some((r) => r.id === habit);
          });
        }),
      );

      expect(results.every(Boolean)).toBe(true);
    });
  });
});
