import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

import { requestContext } from './request-id.middleware';

const REDACT_PATHS = [
  'password',
  'token',
  'key',
  'secret',
  '*.password',
  '*.token',
  '*.key',
  '*.secret',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly pino: Logger;

  constructor() {
    this.pino = pino({
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
      formatters: { level: (label) => ({ level: label }) },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  private ctx(): Record<string, string> {
    const store = requestContext.getStore();
    const out: Record<string, string> = {};
    if (store?.requestId) out['request_id'] = store.requestId;
    if (store?.userId) out['user_id'] = store.userId;
    return out;
  }

  log(message: unknown, context?: string): void {
    this.pino.info({ ...this.ctx(), context }, String(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.pino.error({ ...this.ctx(), context, trace }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.pino.warn({ ...this.ctx(), context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.pino.debug({ ...this.ctx(), context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.pino.trace({ ...this.ctx(), context }, String(message));
  }

  fatal(message: unknown, context?: string): void {
    this.pino.fatal({ ...this.ctx(), context }, String(message));
  }
}
