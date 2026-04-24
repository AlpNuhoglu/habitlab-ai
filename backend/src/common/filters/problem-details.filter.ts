import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorField {
  field: string;
  code: string;
  message: string;
}

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: ErrorField[];
}

// Maps HttpException message objects with a `code` property to RFC 7807 slugs.
const CODE_TO_SLUG: Record<string, string> = {
  CONSENT_REQUIRED: 'consent-required',
  EMAIL_TAKEN: 'email-taken',
  INVALID_CREDENTIALS: 'invalid-credentials',
  EMAIL_NOT_VERIFIED: 'email-not-verified',
  TOKEN_EXPIRED: 'token-expired',
  TOKEN_INVALID: 'token-invalid',
  TOKEN_REUSED: 'token-reused',
  // Habits (WP3)
  HABIT_ARCHIVED: 'habit-archived',
  RETRO_LIMIT_EXCEEDED: 'retro-limit-exceeded',
  FUTURE_DATE: 'future-date',
  HARD_DELETE_LIMIT: 'hard-delete-limit',
};

@Catch(HttpException)
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let code: string | undefined;
    let detail: string;
    let errors: ErrorField[] | undefined;

    if (typeof exceptionResponse === 'string') {
      detail = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const body = exceptionResponse as Record<string, unknown>;
      code = typeof body['code'] === 'string' ? body['code'] : undefined;
      detail = typeof body['message'] === 'string'
        ? body['message']
        : typeof body['error'] === 'string'
          ? body['error']
          : exception.message;

      // class-validator errors come as { message: string[] }
      if (Array.isArray(body['message'])) {
        errors = (body['message'] as string[]).map((msg) => ({
          field: msg.split(' ')[0] ?? 'unknown',
          code: 'VALIDATION_ERROR',
          message: msg,
        }));
        detail = 'One or more fields failed validation. See "errors".';
      }
    } else {
      detail = exception.message;
    }

    const slug = (code !== undefined ? CODE_TO_SLUG[code] : undefined) ??
      STATUS_TO_SLUG[status] ??
      'internal-error';

    const title = STATUS_TO_TITLE[status] ?? 'Error';

    const body: ProblemDetails = {
      type: `https://habitlab.ai/problems/${slug}`,
      title,
      status,
      detail,
      instance: request.path,
    };

    if (errors !== undefined) {
      body.errors = errors;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(`${status} ${request.method} ${request.path}: ${detail}`);
    }

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(body);
  }
}

const STATUS_TO_SLUG: Record<number, string> = {
  400: 'validation-error',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  429: 'rate-limited',
  500: 'internal-error',
};

const STATUS_TO_TITLE: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};
