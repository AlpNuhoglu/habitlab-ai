import { createHash, randomBytes } from 'crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, EntityManager } from 'typeorm';

import { AuditService } from '../../infrastructure/audit/audit.service';
import { TokenPair } from '../../common/helpers/cookie.helper';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './entities/user.entity';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { UserRepository } from './repositories/user.repository';

// bcrypt cost: 12 in production, 4 in tests for speed (NFR-031)
const BCRYPT_ROUNDS = process.env['NODE_ENV'] === 'test' ? 4 : 12;

interface EmailVerifyPayload {
  sub: string;
  purpose: 'email_verify';
  iat: number;
  exp: number;
}

interface PasswordResetPayload {
  sub: string;
  purpose: 'pwd_reset';
  pwFingerprint: string;
  iat: number;
  exp: number;
}

interface LoginMeta {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(UserRepository)
    private readonly userRepo: UserRepository,
    @Inject(RefreshTokenRepository)
    private readonly refreshTokenRepo: RefreshTokenRepository,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    @Inject(ConfigService)
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // ─── Register (FR-001) ────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ userId: string; emailVerificationSent: boolean }> {
    if (!dto.consentGiven) {
      throw new BadRequestException({
        code: 'CONSENT_REQUIRED',
        message: 'You must accept the terms to register.',
      });
    }

    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'This email address is already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const consentGivenAt = new Date();

    const user = await this.dataSource.transaction(async (em) => {
      const created = await em.save(
        em.create(
          User,
          {
            email: dto.email,
            passwordHash,
            timezone: dto.timezone,
            locale: dto.locale,
            consentGivenAt,
          },
        ),
      );

      await this.emitEvent(em, {
        userId: created.id,
        eventType: 'user.registered',
        aggregateType: 'user',
        aggregateId: created.id,
        payload: { timezone: dto.timezone, locale: dto.locale },
      });

      return created;
    });

    const verifyToken = this.signEmailVerifyToken(user.id);
    this.logEmailToken('EMAIL VERIFICATION', user.email, verifyToken);

    return { userId: user.id, emailVerificationSent: true };
  }

  // ─── Verify email (FR-002) ────────────────────────────────────────────────

  async verifyEmail(token: string): Promise<void> {
    const payload = this.decodeToken<EmailVerifyPayload>(token, 'JWT_ACCESS_SECRET');

    if (payload.purpose !== 'email_verify') {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Invalid token.' });
    }

    const user = await this.userRepo.findById(payload.sub);
    if (!user) {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Invalid token.' });
    }

    if (user.emailVerifiedAt !== null) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID',
        message: 'Email is already verified.',
      });
    }

    const verifiedAt = new Date();
    await this.dataSource.transaction(async (em) => {
      await em.update(
        User,
        { id: user.id },
        { emailVerifiedAt: verifiedAt },
      );
      await this.emitEvent(em, {
        userId: user.id,
        eventType: 'user.verified',
        aggregateType: 'user',
        aggregateId: user.id,
        payload: {},
      });
    });
  }

  // ─── Login (FR-003) ───────────────────────────────────────────────────────

  async login(dto: LoginDto, meta: LoginMeta): Promise<TokenPair> {
    // Generic error for both "email not found" and "wrong password" (enumeration protection)
    const invalid = () =>
      new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });

    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) throw invalid();

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) throw invalid();

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email address before logging in.',
      });
    }

    const tokens = await this.generateAndStoreTokenPair(user.id, user.email, meta);

    await this.dataSource.transaction(async (em) => {
      await em.update(
        User,
        { id: user.id },
        { lastLoginAt: new Date() },
      );
      await this.emitEvent(em, {
        userId: user.id,
        eventType: 'user.login',
        aggregateType: 'user',
        aggregateId: user.id,
        payload: {},
      });
    });

    return tokens;
  }

  // ─── Refresh (FR-004) ─────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = hashToken(rawRefreshToken);
    const existing = await this.refreshTokenRepo.findActiveByHash(tokenHash);

    if (!existing) {
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid token.' });
    }

    // A token that has already been replaced means it was reused → token theft detected
    if (existing.replacedBy !== null) {
      await this.refreshTokenRepo.revokeAllForUser(existing.userId, new Date());
      throw new UnauthorizedException({
        code: 'TOKEN_REUSED',
        message: 'Token reuse detected. All sessions have been revoked.',
      });
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED', message: 'Token has expired.' });
    }

    const user = await this.userRepo.findById(existing.userId);
    if (!user) {
      throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'Invalid token.' });
    }

    const newTokens = await this.generateAndStoreTokenPair(user.id, user.email, {
      ip: existing.ipAddress,
      userAgent: existing.userAgent,
    });

    // Revoke old token and link it to the new one
    const newHash = hashToken(newTokens.rawRefreshToken);
    const newToken = await this.refreshTokenRepo.findActiveByHash(newHash);
    if (newToken) {
      await this.refreshTokenRepo.revoke(existing.id, new Date(), newToken.id);
    }

    return newTokens;
  }

  // ─── Logout (FR-005) ──────────────────────────────────────────────────────

  async logout(rawRefreshToken: string | null): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    const token = await this.refreshTokenRepo.findActiveByHash(tokenHash);
    if (token) {
      await this.refreshTokenRepo.revoke(token.id, new Date());
      await this.emitEventDirect({
        userId: token.userId,
        eventType: 'user.logout',
        aggregateType: 'user',
        aggregateId: token.userId,
        payload: {},
      });
    }
  }

  // ─── Forgot password (FR-006) ─────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    // Always return success — enumeration protection (FR-006)
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) return;

    const resetToken = this.signPasswordResetToken(user.id, user.passwordHash);
    this.logEmailToken('PASSWORD RESET', user.email, resetToken);
  }

  // ─── Reset password (FR-007) ──────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const payload = this.decodeToken<PasswordResetPayload>(dto.token, 'JWT_REFRESH_SECRET');

    if (payload.purpose !== 'pwd_reset') {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Invalid token.' });
    }

    const user = await this.userRepo.findById(payload.sub);
    if (!user) {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Invalid token.' });
    }

    // Fingerprint check: token is invalid if password has already changed
    if (user.passwordHash.slice(0, 8) !== payload.pwFingerprint) {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Token has already been used.' });
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.dataSource.transaction(async (em) => {
      await em.update(
        User,
        { id: user.id },
        { passwordHash: newHash },
      );
      await this.refreshTokenRepo.revokeAllForUser(user.id, new Date());
      await this.emitEvent(em, {
        userId: user.id,
        eventType: 'user.password_changed',
        aggregateType: 'user',
        aggregateId: user.id,
        payload: { method: 'reset' },
      });
    });
  }

  // ─── Change password (FR-008) ─────────────────────────────────────────────

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UnauthorizedException();

    const match = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Current password is incorrect.',
      });
    }

    const newHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.dataSource.transaction(async (em) => {
      await em.update(
        User,
        { id: userId },
        { passwordHash: newHash },
      );
      await this.refreshTokenRepo.revokeAllForUser(userId, new Date());
      await this.emitEvent(em, {
        userId,
        eventType: 'user.password_changed',
        aggregateType: 'user',
        aggregateId: userId,
        payload: { method: 'change' },
      });
    });

    this.audit.log({ userId, action: 'user.password_changed', targetType: 'user', targetId: userId });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async generateAndStoreTokenPair(
    userId: string,
    email: string,
    meta: LoginMeta,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({ sub: userId, email, type: 'access' as const });

    const raw = randomBytes(40).toString('hex');
    const tokenHash = hashToken(raw);
    const ttlSeconds = parseInt(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '2592000',
      10,
    );
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.refreshTokenRepo.create({
      userId,
      tokenHash,
      expiresAt,
      ...(meta.ip !== null ? { ipAddress: meta.ip } : {}),
      ...(meta.userAgent !== null ? { userAgent: meta.userAgent } : {}),
    });

    return { accessToken, rawRefreshToken: raw, refreshExpiresAt: expiresAt };
  }

  private signEmailVerifyToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose: 'email_verify' as const },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '24h' },
    );
  }

  private signPasswordResetToken(userId: string, passwordHash: string): string {
    return this.jwtService.sign(
      {
        sub: userId,
        purpose: 'pwd_reset' as const,
        pwFingerprint: passwordHash.slice(0, 8),
      },
      { secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'), expiresIn: '1h' },
    );
  }

  private decodeToken<T extends object>(token: string, secretKey: string): T {
    try {
      return this.jwtService.verify<T>(token, {
        secret: this.config.getOrThrow<string>(secretKey),
      });
    } catch {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Invalid or expired token.' });
    }
  }

  private async emitEvent(
    em: EntityManager,
    event: {
      userId: string;
      eventType: string;
      aggregateType: string;
      aggregateId?: string;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await em.query(
      `INSERT INTO events (user_id, event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.userId,
        event.eventType,
        event.aggregateType,
        event.aggregateId ?? null,
        JSON.stringify(event.payload),
      ],
    );
  }

  // For operations that aren't inside a DataSource.transaction() call
  private async emitEventDirect(event: {
    userId: string;
    eventType: string;
    aggregateType: string;
    aggregateId?: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO events (user_id, event_type, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.userId,
        event.eventType,
        event.aggregateType,
        event.aggregateId ?? null,
        JSON.stringify(event.payload),
      ],
    );
  }

  async getMe(userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'User not found.' });
    const { passwordHash: _pw, ...safe } = user;
    return safe;
  }

  async updateMe(userId: string, dto: UpdateProfileDto): Promise<Omit<User, 'passwordHash'>> {
    const updated = await this.userRepo.updateProfile(userId, {
      ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
      ...(dto.experimentsOptedOut !== undefined
        ? { preferences: { experiments_opted_out: dto.experimentsOptedOut } }
        : {}),
    });
    if (!updated) throw new UnauthorizedException({ code: 'TOKEN_INVALID', message: 'User not found.' });
    const { passwordHash: _pw, ...safe } = updated;
    return safe;
  }

  private logEmailToken(kind: string, email: string, token: string): void {
    this.logger.log(
      `[EMAIL_DRIVER=console] ${kind} | to=${email} | token=${token}`,
    );
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
