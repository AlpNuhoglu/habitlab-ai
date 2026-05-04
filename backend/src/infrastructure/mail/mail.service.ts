import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

export const MAIL_SERVICE = 'MAIL_SERVICE';

export interface MailService {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}

// ─── Null (dev / test) ───────────────────────────────────────────────────────

export class NullMailService implements MailService {
  private readonly logger = new Logger(NullMailService.name);

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    this.logger.log(
      `[EMAIL_DRIVER=console] EMAIL VERIFICATION | to=${to} | token=${token}`,
    );
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    this.logger.log(
      `[EMAIL_DRIVER=console] PASSWORD RESET | to=${to} | token=${token}`,
    );
  }
}

// ─── Resend (production) ──────────────────────────────────────────────────────

function verificationHtml(link: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 24px;color:#1a1a1a;background:#fff">
  <p style="font-weight:700;font-size:18px;color:#1f3a5f;margin:0 0 32px">HabitLab AI</p>
  <h1 style="font-size:22px;margin:0 0 12px;font-weight:600">Verify your email address</h1>
  <p style="color:#555;margin:0 0 28px;line-height:1.6">
    Thanks for signing up. Click the button below to activate your account.
    This link expires in 24 hours.
  </p>
  <a href="${link}" style="display:inline-block;background:#1f3a5f;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
    Verify email
  </a>
  <p style="margin:24px 0 0;font-size:13px;color:#888">
    Or copy this link into your browser:<br>
    <span style="color:#1f3a5f;word-break:break-all">${link}</span>
  </p>
  <hr style="margin:36px 0;border:none;border-top:1px solid #eee">
  <p style="font-size:12px;color:#aaa;margin:0">
    If you didn't create a HabitLab AI account, you can safely ignore this email.
  </p>
</body>
</html>`;
}

function passwordResetHtml(link: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 24px;color:#1a1a1a;background:#fff">
  <p style="font-weight:700;font-size:18px;color:#1f3a5f;margin:0 0 32px">HabitLab AI</p>
  <h1 style="font-size:22px;margin:0 0 12px;font-weight:600">Reset your password</h1>
  <p style="color:#555;margin:0 0 28px;line-height:1.6">
    We received a request to reset your password. Click the button below to choose a new one.
    This link expires in 1 hour.
  </p>
  <a href="${link}" style="display:inline-block;background:#1f3a5f;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
    Reset password
  </a>
  <p style="margin:24px 0 0;font-size:13px;color:#888">
    Or copy this link into your browser:<br>
    <span style="color:#1f3a5f;word-break:break-all">${link}</span>
  </p>
  <hr style="margin:36px 0;border:none;border-top:1px solid #eee">
  <p style="font-size:12px;color:#aaa;margin:0">
    If you didn't request a password reset, you can safely ignore this email.
    Your password will not change.
  </p>
</body>
</html>`;
}

export class ResendMailService implements MailService {
  private readonly client: Resend;
  private readonly logger = new Logger(ResendMailService.name);

  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly appUrl: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: 'Verify your HabitLab AI email',
      html: verificationHtml(link),
      text: `Verify your email: ${link}`,
    });
    if (error) {
      this.logger.error(`Resend error (verification) to=${to}: ${JSON.stringify(error)}`);
    }
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const { error } = await this.client.emails.send({
      from: this.from,
      to,
      subject: 'Reset your HabitLab AI password',
      html: passwordResetHtml(link),
      text: `Reset your password: ${link}`,
    });
    if (error) {
      this.logger.error(`Resend error (reset) to=${to}: ${JSON.stringify(error)}`);
    }
  }
}
