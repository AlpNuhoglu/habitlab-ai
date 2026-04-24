import type { Response } from 'express';

export interface TokenPair {
  accessToken: string;
  rawRefreshToken: string;
  refreshExpiresAt: Date;
}

const IS_PROD = process.env['NODE_ENV'] === 'production';

// Access token: 15 min
const ACCESS_MAX_AGE_MS = 15 * 60 * 1000;

export function setAuthCookies(res: Response, tokens: TokenPair): void {
  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD,
    path: '/',
    maxAge: ACCESS_MAX_AGE_MS,
  });

  res.cookie('refresh_token', tokens.rawRefreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD,
    path: '/api/v1/auth/refresh',
    maxAge: tokens.refreshExpiresAt.getTime() - Date.now(),
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie('access_token', { httpOnly: true, sameSite: 'strict', secure: IS_PROD, path: '/' });
  res.clearCookie('refresh_token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD,
    path: '/api/v1/auth/refresh',
  });
}
