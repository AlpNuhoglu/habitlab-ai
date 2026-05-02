import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';

export interface PushPayload {
  title: string;
  body: string;
  habitId: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keysP256dh: string;
  keysAuth: string;
}

@Injectable()
export class WebPushService implements OnModuleInit {
  private readonly logger = new Logger(WebPushService.name);
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT');
    const nodeEnv = this.config.get<string>('NODE_ENV');

    if (!privateKey || !publicKey || !subject || nodeEnv === 'test') {
      this.logger.log('WebPush disabled — VAPID keys absent or test mode');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
    this.logger.log('WebPush enabled');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async send(subscription: PushSubscriptionData, payload: PushPayload): Promise<'ok' | 'gone' | 'error'> {
    if (!this.enabled) {
      this.logger.debug(`WebPush no-op for endpoint …${subscription.endpoint.slice(-20)}`);
      return 'ok';
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.keysP256dh, auth: subscription.keysAuth },
        },
        JSON.stringify(payload),
      );
      return 'ok';
    } catch (err: unknown) {
      const statusCode =
        err !== null && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : 0;

      if (statusCode === 410) {
        this.logger.debug(`Subscription gone (410): ${subscription.endpoint.slice(-30)}`);
        return 'gone';
      }

      this.logger.error(`Push send failed (status ${statusCode}): ${String(err)}`);
      return 'error';
    }
  }
}
