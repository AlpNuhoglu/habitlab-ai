import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import type { Repository } from 'typeorm';

import { RefreshToken } from '../entities/refresh-token.entity';
import type { User } from '../entities/user.entity';

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

  async create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    const token = this.repo.create({
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress } : {}),
      ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
    });
    // Wire up the user relation via userId so the FK constraint is satisfied
    // without loading the full User record.
    token.user = { id: data.userId } as User;
    return this.repo.save(token);
  }

  async findActiveByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
  }

  async revoke(id: string, revokedAt: Date, replacedById?: string): Promise<void> {
    await this.repo.update(
      { id },
      {
        revokedAt,
        ...(replacedById !== undefined ? { replacedBy: replacedById } : {}),
      },
    );
  }

  // Revoke every active token for a user (logout-all, password reset).
  async revokeAllForUser(userId: string, revokedAt: Date): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .execute();
  }

  // Chain-wide revocation on token-theft detection (FR-004).
  // When a token that already has replacedBy set is presented, every token
  // in the chain for that user must be revoked immediately.
  async revokeAllForUserExcept(
    userId: string,
    keepId: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt })
      .where('user_id = :userId AND id != :keepId AND revoked_at IS NULL', {
        userId,
        keepId,
      })
      .execute();
  }
}
