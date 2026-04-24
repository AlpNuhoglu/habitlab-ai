import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const cookies = request.cookies as Record<string, string | undefined>;
    const token = cookies['access_token'];

    if (!token) {
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'No access token.' });
    }

    try {
      const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
      const payload = jwt.verify(token, secret) as AccessTokenPayload;

      if (payload.type !== 'access') {
        throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid token type.' });
      }

      // Attach user to request so controllers can access it via req.user
      (request as Request & { user: AccessTokenPayload }).user = payload;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid or expired access token.' });
    }
  }
}
