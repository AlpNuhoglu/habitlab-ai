import { Injectable, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import pino from 'pino';
import { Observable, tap } from 'rxjs';

import { requestContext } from './request-id.middleware';

interface AuthedRequest extends Request {
  user?: { id?: string };
  route: { path: string };
}

const logger = pino({
  level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
});

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const res = http.getResponse<Response>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(req, res.statusCode, Date.now() - start),
        error: (err: unknown) => {
          const status =
            err !== null && typeof err === 'object' && 'status' in err
              ? (err as { status: number }).status
              : 500;
          this.logRequest(req, status, Date.now() - start);
        },
      }),
    );
  }

  private logRequest(req: AuthedRequest, status: number, duration_ms: number): void {
    const store = requestContext.getStore();
    logger.info({
      request_id: store?.requestId,
      user_id: req.user?.id,
      method: req.method,
      route: req.route?.path ?? req.url,
      status,
      duration_ms,
    }, 'http');
  }
}
