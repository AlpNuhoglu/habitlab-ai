import 'reflect-metadata';

import type { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { SubscribeDto } from './dto/subscribe.dto';
import { isAllowedPushEndpoint } from './push-endpoint';
import { WebPushService } from './web-push.service';

describe('isAllowedPushEndpoint', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc123',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
    'https://web.push.apple.com/QGx1',
  ])('accepts browser push service %s', (url) => {
    expect(isAllowedPushEndpoint(url)).toBe(true);
  });

  it.each([
    ['plain http', 'http://fcm.googleapis.com/fcm/send/abc'],
    ['cloud metadata IP', 'https://169.254.169.254/latest/meta-data'],
    ['private IP', 'https://10.0.0.5:6379/'],
    ['loopback', 'https://127.0.0.1/'],
    ['IPv6 loopback', 'https://[::1]/'],
    ['localhost', 'https://localhost/push'],
    ['arbitrary host', 'https://attacker.example.com/collect'],
    // Suffix matching must be on a label boundary, or anyone can register one.
    ['look-alike suffix', 'https://evilfcm.googleapis.com.attacker.io/'],
    ['look-alike label', 'https://notfcm.googleapis.com/'],
    ['credentials in URL', 'https://user:pw@fcm.googleapis.com/fcm/send/abc'],
    ['non-default port', 'https://fcm.googleapis.com:8443/fcm/send/abc'],
    ['not a URL', 'not a url'],
    ['empty', ''],
  ])('rejects %s', (_label, url) => {
    expect(isAllowedPushEndpoint(url)).toBe(false);
  });
});

describe('SubscribeDto', () => {
  const validate = (body: unknown) =>
    validateSync(plainToInstance(SubscribeDto, body), { whitelist: true, forbidNonWhitelisted: true })
      .map((e) => e.property);

  const keys = { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) };

  it('accepts a real push service endpoint', () => {
    expect(validate({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys })).toEqual([]);
  });

  it('rejects an internal endpoint (SSRF)', () => {
    expect(validate({ endpoint: 'http://169.254.169.254/latest/meta-data', keys })).toContain('endpoint');
  });

  it('rejects oversized keys and userAgent', () => {
    expect(
      validate({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: { p256dh: 'p'.repeat(5000), auth: 'a'.repeat(5000) },
        userAgent: 'u'.repeat(5000),
      }),
    ).toEqual(expect.arrayContaining(['keys', 'userAgent']));
  });
});

describe('WebPushService.send', () => {
  // Rows stored before endpoint validation existed must never be dialled.
  it('refuses a stored endpoint outside the allow-list and reports it gone', async () => {
    const config = { get: () => undefined } as unknown as ConfigService;
    const service = new WebPushService(config);
    service.onModuleInit();

    const result = await service.send(
      { endpoint: 'http://169.254.169.254/latest/meta-data', keysP256dh: 'p', keysAuth: 'a' },
      { title: 't', body: 'b', habitId: 'h' },
    );

    expect(result).toBe('gone');
  });
});
