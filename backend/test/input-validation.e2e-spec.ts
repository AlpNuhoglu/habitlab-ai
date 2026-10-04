/**
 * Input validation contract (security hardening).
 *
 * Every case here is malformed input that used to reach PostgreSQL (surfacing
 * as a 500) or, for push endpoints, was stored and later dialled by the
 * server. Each must now be refused at the edge with a 400. Positive controls
 * sit beside the negative ones so a route that 400s on everything can't pass.
 *
 * Requires a real PostgreSQL instance at DATABASE_URL, freshly migrated.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import type { Test as SuperTest } from 'supertest';

import { AppModule } from '../src/app.module';

function getCookies(res: { headers: Record<string, unknown> }): string[] {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') return [raw];
  return [];
}

const RUN = Date.now();
const email = (suffix: string) => `validation+${RUN}+${suffix}@example.com`;
const NOT_A_UUID = 'not-a-uuid';
const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

describe('Input validation (e2e)', () => {
  let app: INestApplication;
  let cookie: string;
  let habitId: string;

  const http = () => request(app.getHttpServer());
  const authed = (req: SuperTest): SuperTest => req.set('Cookie', [`access_token=${cookie}`]);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    app.use(cookieParser());
    await app.init();

    const reg = await http()
      .post('/auth/register')
      .send({ email: email('main'), password: 'Password1', timezone: 'UTC', locale: 'en', consentGiven: true })
      .expect(202);
    const userId = (reg.body as { userId: string }).userId;

    const secret = app.get(ConfigService).getOrThrow<string>('JWT_ACCESS_SECRET');
    const verifyToken = jwt.sign({ sub: userId, purpose: 'email_verify' }, secret, { expiresIn: '1h' });
    await http().get('/auth/verify').query({ token: verifyToken }).expect(200);

    const login = await http()
      .post('/auth/login')
      .send({ email: email('main'), password: 'Password1' })
      .expect(200);
    const found = getCookies(login).find((c) => c.startsWith('access_token='));
    if (!found) throw new Error('No access_token cookie after login');
    cookie = found.split(';')[0]!.slice('access_token='.length);

    const habit = await authed(http().post('/habits'))
      .send({ name: 'Validation habit', frequencyType: 'daily' })
      .expect(201);
    habitId = (habit.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Push subscriptions: SSRF ─────────────────────────────────────────────

  describe('POST /notifications/subscriptions', () => {
    const keys = { p256dh: 'fakep256dh', auth: 'fakeauth' };

    it.each([
      'http://169.254.169.254/latest/meta-data',
      'https://10.0.0.5:6379/',
      'https://localhost/push',
      'https://attacker.example.com/collect',
    ])('refuses non-push-service endpoint %s', async (endpoint) => {
      await authed(http().post('/notifications/subscriptions')).send({ endpoint, keys }).expect(400);
    });

    it('accepts a browser push service endpoint', async () => {
      await authed(http().post('/notifications/subscriptions'))
        .send({ endpoint: `https://fcm.googleapis.com/fcm/send/${RUN}-validation`, keys })
        .expect(201);
    });
  });

  // ─── Path parameters ──────────────────────────────────────────────────────

  describe('non-UUID :id', () => {
    it.each([
      ['GET', `/habits/${NOT_A_UUID}`],
      ['PATCH', `/habits/${NOT_A_UUID}`],
      ['DELETE', `/habits/${NOT_A_UUID}`],
      ['POST', `/habits/${NOT_A_UUID}/unarchive`],
      ['POST', `/habits/${NOT_A_UUID}/log`],
      ['DELETE', `/habits/${NOT_A_UUID}/log/2026-01-01`],
      ['PATCH', `/habits/${NOT_A_UUID}/log/2026-01-01`],
      ['POST', `/recommendations/${NOT_A_UUID}/dismiss`],
      ['POST', `/recommendations/${NOT_A_UUID}/accept`],
    ])('%s %s → 400', async (method, path) => {
      const req = authed(http()[method.toLowerCase() as 'get' | 'patch' | 'delete' | 'post'](path));
      await req.send({ status: 'completed', note: 'x' }).expect(400);
    });

    it('a well-formed but unknown UUID is still a 404', async () => {
      await authed(http().get(`/habits/${UNKNOWN_UUID}`)).expect(404);
      await authed(http().post(`/recommendations/${UNKNOWN_UUID}/dismiss`)).expect(404);
    });
  });

  describe(':date on habit logs', () => {
    it.each(['not-a-date', '2026-02-30', '2026-13-01', '20260101'])('DELETE log/%s → 400', async (date) => {
      await authed(http().delete(`/habits/${habitId}/log/${date}`)).expect(400);
    });

    it('PATCH log/<impossible date> → 400', async () => {
      await authed(http().patch(`/habits/${habitId}/log/2026-02-30`)).send({ note: 'x' }).expect(400);
    });
  });

  // ─── Request bodies ───────────────────────────────────────────────────────

  describe('habit bodies', () => {
    it.each([
      [{ weekdayMask: 'hacked' }],
      [{ weekdayMask: 999 }],
      [{ targetCountPerWeek: -999 }],
      [{ targetCountPerWeek: 'seven' }],
      [{ preferredTime: '99:99' }],
      [{ preferredTime: '24:00' }],
    ])('PATCH /habits/:id %j → 400', async (body) => {
      await authed(http().patch(`/habits/${habitId}`)).send(body).expect(400);
    });

    it('PATCH /habits/:id with a valid preferredTime still works', async () => {
      await authed(http().patch(`/habits/${habitId}`)).send({ preferredTime: '23:59' }).expect(200);
    });

    it('POST /habits rejects an out-of-range preferredTime', async () => {
      await authed(http().post('/habits'))
        .send({ name: 'Bad time', frequencyType: 'daily', preferredTime: '25:61' })
        .expect(400);
    });

    it('POST /habits/:id/log rejects an impossible date', async () => {
      await authed(http().post(`/habits/${habitId}/log`))
        .send({ status: 'completed', date: '2026-02-30' })
        .expect(400);
    });
  });

  // ─── Query parameters ─────────────────────────────────────────────────────

  describe('GET /habits pagination', () => {
    it.each(['limit=-5', 'offset=-1', 'limit=abc', 'offset=1.5'])('?%s → 400', async (qs) => {
      await authed(http().get(`/habits?${qs}`)).expect(400);
    });

    it('?limit=10&offset=0 → 200', async () => {
      await authed(http().get('/habits?limit=10&offset=0')).expect(200);
    });

    it('a limit above the maximum is clamped, not rejected', async () => {
      await authed(http().get('/habits?limit=5000')).expect(200);
    });
  });

  describe('GET /coach/chat/history', () => {
    it.each(['limit=abc', 'limit=0', 'limit=-1', `before=${NOT_A_UUID}`])('?%s → 400', async (qs) => {
      await authed(http().get(`/coach/chat/history?${qs}`)).expect(400);
    });

    it('?limit=10 → 200', async () => {
      await authed(http().get('/coach/chat/history?limit=10')).expect(200);
    });
  });

  describe('GET /experiments/variant', () => {
    it('rejects keys passed as an array', async () => {
      await authed(http().get('/experiments/variant?keys[]=a&keys[]=b')).expect(400);
    });

    it('rejects more than 20 keys in one request', async () => {
      const keys = Array.from({ length: 21 }, (_, i) => `k${i}`).join(',');
      await authed(http().get(`/experiments/variant?keys=${keys}`)).expect(400);
    });

    it('rejects a malformed key', async () => {
      await authed(http().get(`/experiments/variant?keys=${'x'.repeat(200)}`)).expect(400);
      await authed(http().get(`/experiments/variant?keys=${encodeURIComponent("a'; DROP TABLE x")}`)).expect(400);
    });

    it('accepts well-formed keys', async () => {
      await authed(http().get('/experiments/variant?keys=rec_copy_v1,notification_copy_v1')).expect(200);
    });
  });

  describe('GET /habits/:id/calendar', () => {
    it('rejects an impossible calendar date', async () => {
      await authed(http().get(`/habits/${habitId}/calendar?from=2026-02-30&to=2026-03-10`)).expect(400);
    });

    it('accepts a real range', async () => {
      await authed(http().get(`/habits/${habitId}/calendar?from=2026-02-01&to=2026-03-01`)).expect(200);
    });
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  describe('auth', () => {
    it('GET /auth/verify rejects a token passed as an array', async () => {
      await http().get('/auth/verify?token[]=a&token[]=b').expect(400);
    });

    // bcrypt silently ignores everything past 72 bytes.
    it('POST /auth/register rejects a password longer than 72 bytes', async () => {
      await http()
        .post('/auth/register')
        .send({ email: email('long'), password: 'A1' + 'x'.repeat(71), timezone: 'UTC', locale: 'en', consentGiven: true })
        .expect(400);
    });

    it('POST /auth/register counts bytes, not characters', async () => {
      // 37 two-byte characters = 74 bytes.
      await http()
        .post('/auth/register')
        .send({ email: email('multibyte'), password: 'A1' + 'ş'.repeat(36), timezone: 'UTC', locale: 'en', consentGiven: true })
        .expect(400);
    });

    it('POST /auth/login rejects an absurdly long password without hashing it', async () => {
      await http()
        .post('/auth/login')
        .send({ email: email('main'), password: 'x'.repeat(2000) })
        .expect(400);
    });
  });
});
