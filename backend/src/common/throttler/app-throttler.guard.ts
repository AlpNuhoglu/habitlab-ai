import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

interface MaybeAuthedRequest extends Request {
  user?: { sub?: string };
}

/**
 * Throttles by authenticated user id when available, otherwise by client IP.
 *
 * Public auth routes (login, register, password reset) have no user attached,
 * so they fall back to IP — the correct key for brute-force / credential-
 * stuffing protection. Authenticated routes key on the user id so one tenant
 * cannot exhaust another's allowance and shared NAT/proxy IPs are not punished
 * collectively.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const typed = req as unknown as MaybeAuthedRequest;
    const userId = typed.user?.sub;
    if (userId) return `user:${userId}`;

    // express populates req.ips when 'trust proxy' is set; fall back to req.ip.
    const ip = typed.ips?.length ? typed.ips[0] : typed.ip;
    return `ip:${ip ?? 'unknown'}`;
  }
}
