import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { Public } from '../../common/decorators/public.decorator';
import { clearAuthCookies, setAuthCookies } from '../../common/helpers/cookie.helper';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

// RequestUser is populated by JwtAuthGuard (wired in ADIM 5).
export interface RequestUser {
  sub: string;
  email: string;
}

function getUser(req: Request): RequestUser {
  // req.user is populated by JwtAuthGuard (wired in ADIM 5)
  const authed = req as Request & { user?: RequestUser };
  if (!authed.user) throw new UnauthorizedException();
  return authed.user;
}

function refreshCookie(req: Request): string | null {
  const cookies = req.cookies as Record<string, string | undefined>;
  return cookies['refresh_token'] ?? null;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  // TODO(WP5): rate-limit 5 per IP per hour
  @Public()
  @Post('register')
  @HttpCode(202)
  @ApiOperation({ summary: 'Register a new user (FR-001)' })
  @ApiResponse({ status: 202, description: 'User created; verification email sent.' })
  @ApiResponse({ status: 400, description: 'Validation error or CONSENT_REQUIRED.' })
  @ApiResponse({ status: 409, description: 'EMAIL_TAKEN.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Get('verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify email address (FR-002)' })
  @ApiResponse({ status: 200, description: 'Email verified.' })
  @ApiResponse({ status: 400, description: 'TOKEN_INVALID or already verified.' })
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { verified: true };
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(202)
  @ApiOperation({ summary: 'Resend email verification link' })
  @ApiResponse({ status: 202, description: 'Always 202 (enumeration protection).' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto.email);
    return { message: 'If that email is unverified, a new link has been sent.' };
  }

  // TODO(WP5): rate-limit 10 per IP per minute
  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email + password (FR-003)' })
  @ApiResponse({ status: 200, description: 'Login successful; cookies set.' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS.' })
  @ApiResponse({ status: 403, description: 'EMAIL_NOT_VERIFIED.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = {
      ip: (req.ip as string | undefined) ?? null,
      userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    };
    const tokens = await this.authService.login(dto, meta);
    setAuthCookies(res, tokens);
    return { message: 'Login successful.' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token (FR-004)' })
  @ApiResponse({ status: 200, description: 'Tokens rotated; new cookies set.' })
  @ApiResponse({ status: 401, description: 'TOKEN_INVALID, TOKEN_EXPIRED, or TOKEN_REUSED.' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = refreshCookie(req);
    if (!raw) throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'No refresh token.' });
    const tokens = await this.authService.refresh(raw);
    setAuthCookies(res, tokens);
    return { message: 'Token refreshed.' };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log out and revoke refresh token (FR-005)' })
  @ApiResponse({ status: 200, description: 'Logged out.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(refreshCookie(req));
    clearAuthCookies(res);
    return { message: 'Logged out.' };
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(200)
  @ApiOperation({ summary: 'Request password reset link (FR-006)' })
  @ApiResponse({ status: 200, description: 'Always 200 (enumeration protection).' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { message: 'If that email is registered, a reset link has been sent.' };
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Complete password reset with token (FR-007)' })
  @ApiResponse({ status: 200, description: 'Password reset.' })
  @ApiResponse({ status: 400, description: 'TOKEN_INVALID or expired.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password reset successful.' };
  }

  @Post('password/change')
  @HttpCode(200)
  @ApiOperation({ summary: 'Change password while authenticated (FR-008)' })
  @ApiResponse({ status: 200, description: 'Password changed; other sessions revoked.' })
  @ApiResponse({ status: 401, description: 'INVALID_CREDENTIALS.' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const user = getUser(req);
    await this.authService.changePassword(user.sub, dto);
    return { message: 'Password changed.' };
  }
}
