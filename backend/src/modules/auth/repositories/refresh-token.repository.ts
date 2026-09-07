import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import type { DataSource, EntityManager, Repository } from 'typeorm';

import { PRIVILEGED_DATA_SOURCE } from '../../../infrastructure/database/database.tokens';
import { RefreshToken } from '../entities/refresh-token.entity';

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RefreshTokenRepository {
  private readonly repo: Repository<RefreshToken>;

  constructor(
    // Refresh tokens are authentication infrastructure, not tenant data, and
    // this repository is unusable on a tenant-scoped pool: findByHash below
    // deliberately queries without a user_id, and /auth/refresh is @Public()
    // so no tenant is in context when it runs. Isolation here rests on
    // presenting the raw token, which is a stronger secret than a user id.
    @Inject(PRIVILEGED_DATA_SOURCE) dataSource: DataSource,
  ) {
    this.repo = dataSource.getRepository(RefreshToken);
  }

  async create(data: CreateRefreshTokenData, em?: EntityManager): Promise<RefreshToken> {
    const repo = em ? em.getRepository(RefreshToken) : this.repo;
    const token = repo.create({
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      ...(data.ipAddress !== undefined ? { ipAddress: data.ipAddress } : {}),
      ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
    });
    return repo.save(token);
  }

  // Reuse detection needs revoked rows too: a replayed token is revoked by
  // definition, so filtering them out here would hide the theft (FR-004).
  async findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({ where: { tokenHash } });
  }

  async findActiveByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
    });
  }

  async revoke(
    id: string,
    revokedAt: Date,
    replacedById?: string,
    em?: EntityManager,
  ): Promise<void> {
    const repo = em ? em.getRepository(RefreshToken) : this.repo;
    await repo.update(
      { id },
      {
        revokedAt,
        ...(replacedById !== undefined ? { replacedBy: replacedById } : {}),
      },
    );
  }

  // Revoke every active token for a user (logout-all, password reset).
  async revokeAllForUser(userId: string, revokedAt: Date, em?: EntityManager): Promise<void> {
    const repo = em ? em.getRepository(RefreshToken) : this.repo;
    await repo
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .execute();
  }
}
