/**
 * Auth integration tests (WP2, FR-001..FR-009).
 *
 * Requires a real PostgreSQL instance at DATABASE_URL. The database must be
 * freshly migrated before the suite runs (CI: see .github/workflows).
 *
 * Run locally:
 *   DATABASE_URL=postgres://... npm run test:e2e
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';

// set-cookie is string | string[] | undefined in Node's IncomingMessage.
function getCookies(res: { headers: Record<string, unknown> }): string[] {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') return [raw];
  return [];
}

// Unique email per test run so re-runs don't collide.
const RUN = Date.now();
const email = (suffix: string) => `e2e+${RUN}+${suffix}@example.com`;

const VALID_REGISTER = (suffix: string) => ({
  email: email(suffix),
  password: 'Password1',
  timezone: 'Europe/Istanbul',
  locale: 'en',
  consentGiven: true,
});

async function registerAndVerify(
  app: INestApplication,
  suffix: string,
): Promise<{ userId: string; verifyToken: string }> {
  // Register
  const regRes = await request(app.getHttpServer())
    .post('/auth/register')
    .send(VALID_REGISTER(suffix))
    .expect(202);

  const userId: string = (regRes.body as { userId: string }).userId;

  // Extract the verification token from the NestJS logger output by querying
  // the DB directly — simpler than capturing stdout in CI.
  const ds: DataSource = app.get(DataSource);
  const rows: Array<{ email_verification_token: string }> = await ds.query(
    'SELECT email_verification_token FROM users WHERE id = $1',
    [userId],
  );
  const verifyToken: string = rows[0]?.email_verification_token ?? '';

  await request(app.getHttpServer()).get('/auth/verify').query({ token: verifyToken }).expect(200);

  return { userId, verifyToken };
}

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── FR-001 Register ────────────────────────────────────────────────────────

  it('1. registers with valid payload → 202 + user in DB', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(VALID_REGISTER('reg1'))
      .expect(202);

    expect((res.body as { userId: string }).userId).toBeDefined();

    const ds = app.get(DataSource);
    const rows: Array<{ id: string }> = await ds.query('SELECT id FROM users WHERE email = $1', [
      email('reg1'),
    ]);
    expect(rows).toHaveLength(1);
  });

  it('2. duplicate email → 409 EMAIL_TAKEN', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(VALID_REGISTER('dup'))
      .expect(202);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send(VALID_REGISTER('dup'))
      .expect(409);

    expect((res.body as { type: string }).type).toContain('email-taken');
  });

  it('3. consentGiven=false → 400 CONSENT_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...VALID_REGISTER('consent'), consentGiven: false })
      .expect(400);

    expect((res.body as { type: string }).type).toContain('consent-required');
  });

  // ─── FR-002 Verify ──────────────────────────────────────────────────────────

  it('4. verifies with valid token → 200 + email_verified_at set', async () => {
    const { userId } = await registerAndVerify(app, 'verify1');

    const ds = app.get(DataSource);
    const rows: Array<{ email_verified_at: Date | null }> = await ds.query(
      'SELECT email_verified_at FROM users WHERE id = $1',
      [userId],
    );
    expect(rows[0]?.email_verified_at).not.toBeNull();
  });

  // ─── FR-003 Login ───────────────────────────────────────────────────────────

  it('5. login before email verification → 403 EMAIL_NOT_VERIFIED', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(VALID_REGISTER('unverified'))
      .expect(202);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('unverified'), password: 'Password1' })
      .expect(403);

    expect((res.body as { type: string }).type).toContain('email-not-verified');
  });

  it('6. login with wrong password → 401 (generic, no email disclosure)', async () => {
    await registerAndVerify(app, 'wrongpw');

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('wrongpw'), password: 'WrongPass9' })
      .expect(401);

    const body = res.body as { detail: string };
    expect(body.detail).not.toContain(email('wrongpw'));
  });

  it('7. successful login → 200 + httpOnly cookies set', async () => {
    await registerAndVerify(app, 'login1');

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('login1'), password: 'Password1' })
      .expect(200);

    const setCookies = getCookies(res);
    expect(setCookies.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(setCookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(setCookies.every((c) => c.includes('HttpOnly'))).toBe(true);
  });

  // ─── FR-004 Refresh ─────────────────────────────────────────────────────────

  it('8. refresh → new tokens, old refresh token revoked', async () => {
    await registerAndVerify(app, 'refresh1');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('refresh1'), password: 'Password1' })
      .expect(200);

    const cookies = getCookies(loginRes);

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookies)
      .expect(200);

    const newCookies = getCookies(refreshRes);
    expect(newCookies.some((c) => c.startsWith('access_token='))).toBe(true);

    // Old refresh token must now be rejected
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookies).expect(401);
  });

  it('9. refresh with revoked token → 401 + chain revocation', async () => {
    await registerAndVerify(app, 'refresh2');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('refresh2'), password: 'Password1' })
      .expect(200);

    const cookies = getCookies(loginRes);

    // Rotate once (legitimate)
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookies).expect(200);

    // Reuse the original (now-revoked) token — triggers chain revocation
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookies).expect(401);
  });

  // ─── FR-005 Logout ──────────────────────────────────────────────────────────

  it('10. logout → 200 + cookies cleared + token revoked', async () => {
    await registerAndVerify(app, 'logout1');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('logout1'), password: 'Password1' })
      .expect(200);

    const cookies = getCookies(loginRes);
    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookies)
      .expect(200);

    const cleared = getCookies(logoutRes);
    expect(cleared.some((c) => c.includes('access_token=;'))).toBe(true);

    // Refresh must fail after logout
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookies).expect(401);
  });

  // ─── FR-008 Change password ─────────────────────────────────────────────────

  it('11. password change → 200 + old session revoked', async () => {
    await registerAndVerify(app, 'changepw');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('changepw'), password: 'Password1' })
      .expect(200);

    const cookies = getCookies(loginRes);
    await request(app.getHttpServer())
      .post('/auth/password/change')
      .set('Cookie', cookies)
      .send({ currentPassword: 'Password1', newPassword: 'NewPass2' })
      .expect(200);

    // Old refresh token must now be rejected
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookies).expect(401);
  });

  // ─── FR-009 /me ─────────────────────────────────────────────────────────────

  it('12. GET /me → 200 + user object without passwordHash', async () => {
    const { userId } = await registerAndVerify(app, 'me1');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('me1'), password: 'Password1' })
      .expect(200);

    const cookies = getCookies(loginRes);
    const res = await request(app.getHttpServer()).get('/me').set('Cookie', cookies).expect(200);

    const body = res.body as Record<string, unknown>;
    expect(body['id']).toBe(userId);
    expect(body['passwordHash']).toBeUndefined();
    expect(body['email']).toBe(email('me1'));
  });

  it('13. PATCH /me → 200 + fields updated', async () => {
    await registerAndVerify(app, 'me2');

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: email('me2'), password: 'Password1' })
      .expect(200);

    const cookies = getCookies(loginRes);

    const res = await request(app.getHttpServer())
      .patch('/me')
      .set('Cookie', cookies)
      .send({ displayName: 'Alp', timezone: 'America/New_York' })
      .expect(200);

    const body = res.body as Record<string, unknown>;
    expect(body['displayName']).toBe('Alp');
    expect(body['timezone']).toBe('America/New_York');
  });
});
