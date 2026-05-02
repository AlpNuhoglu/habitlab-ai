import { Injectable, CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { route?: { path: string } }>();
    const res = http.getResponse<Response>();
    const end = this.metrics.httpRequestDuration.startTimer({
      method: req.method,
      route: req.route?.path ?? req.url,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          const route = req.route?.path ?? req.url;
          end({ method: req.method, route });
          this.metrics.httpRequestsTotal.inc({ method: req.method, route, status: String(res.statusCode) });
          if (res.statusCode >= 400) {
            this.metrics.httpRequestErrorsTotal.inc({
              method: req.method,
              route,
              status: String(res.statusCode),
            });
          }
        },
        error: (err: unknown) => {
          const route = req.route?.path ?? req.url;
          const status =
            err !== null && typeof err === 'object' && 'status' in err
              ? String((err as { status: number }).status)
              : '500';
          end({ method: req.method, route });
          this.metrics.httpRequestsTotal.inc({ method: req.method, route, status });
          this.metrics.httpRequestErrorsTotal.inc({ method: req.method, route, status });
        },
      }),
    );
  }
}
