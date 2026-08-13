import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import type { EntityManager, Repository } from 'typeorm';

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
  constructor(
    @InjectRepository(RefreshToken)
    private readonly repo: Repository<RefreshToken>,
  ) {}

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
