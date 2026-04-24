import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import type { Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import type { UserPreferences } from '../entities/user.entity';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  timezone: string;
  locale: string;
  consentGivenAt: Date;
  displayName?: string;
}

export interface UpdateProfileData {
  displayName?: string | null;
  timezone?: string;
  locale?: string;
  preferences?: Partial<UserPreferences>;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email, deletedAt: IsNull() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id, deletedAt: IsNull() } });
  }

  async create(data: CreateUserData): Promise<User> {
    const user = this.repo.create({
      email: data.email,
      passwordHash: data.passwordHash,
      timezone: data.timezone,
      locale: data.locale,
      consentGivenAt: data.consentGivenAt,
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
    });
    return this.repo.save(user);
  }

  async markEmailVerified(id: string, verifiedAt: Date): Promise<void> {
    await this.repo.update({ id }, { emailVerifiedAt: verifiedAt });
  }

  async recordLogin(id: string, loginAt: Date): Promise<void> {
    await this.repo.update({ id }, { lastLoginAt: loginAt });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id }, { passwordHash });
  }

  async updateProfile(id: string, data: UpdateProfileData): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) return null;

    if (data.displayName !== undefined) {
      user.displayName = data.displayName;
    }
    if (data.timezone !== undefined) {
      user.timezone = data.timezone;
    }
    if (data.locale !== undefined) {
      user.locale = data.locale;
    }
    if (data.preferences !== undefined) {
      user.preferences = { ...user.preferences, ...data.preferences };
    }
    return this.repo.save(user);
  }

  async softDelete(id: string, deletedAt: Date): Promise<void> {
    await this.repo.update({ id }, { deletedAt });
  }
}
