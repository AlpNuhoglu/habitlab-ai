import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';

import { ExperimentVariant } from './entities/experiment.entity';
import { ExperimentRepository } from './experiment.repository';

interface UserPreferencesRow {
  preferences: { experiments_opted_out?: boolean };
}

@Injectable()
export class AssignmentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly experimentRepo: ExperimentRepository,
  ) {}

  /**
   * Returns the variant key for a (user, experimentKey) pair.
   * Persists the assignment if it does not yet exist.
   * Returns variants[0].key ('control') when:
   *   - experiment not found or not running
   *   - user has opted out of experiments
   */
  async getOrAssign(userId: string, experimentKey: string): Promise<string> {
    const experiment = await this.experimentRepo.findByKey(experimentKey);

    if (!experiment || experiment.status !== 'running') {
      return 'control';
    }

    if (await this.isOptedOut(userId)) {
      return experiment.variants[0]?.key ?? 'control';
    }

    const existing = await this.experimentRepo.findAssignment(userId, experiment.id);
    if (existing) return existing.variantKey;

    const variantKey = this.computeVariant(userId, experimentKey, experiment.variants);

    await this.dataSource.transaction(async (em) => {
      await this.experimentRepo.createAssignment(userId, experiment.id, variantKey, em);
    });

    return variantKey;
  }

  /**
   * Same as getOrAssign but returns null when the experiment is not running.
   * Use this when null means "don't record the variant" (e.g. recommendation worker).
   */
  async getOrAssignIfActive(userId: string, experimentKey: string): Promise<string | null> {
    const experiment = await this.experimentRepo.findByKey(experimentKey);
    if (!experiment || experiment.status !== 'running') return null;

    if (await this.isOptedOut(userId)) return null;

    const existing = await this.experimentRepo.findAssignment(userId, experiment.id);
    if (existing) return existing.variantKey;

    const variantKey = this.computeVariant(userId, experimentKey, experiment.variants);

    await this.dataSource.transaction(async (em) => {
      await this.experimentRepo.createAssignment(userId, experiment.id, variantKey, em);
    });

    return variantKey;
  }

  // §6.5.1 — deterministic SHA-256 hash assignment
  private computeVariant(userId: string, experimentKey: string, variants: ExperimentVariant[]): string {
    const hash = createHash('sha256').update(`${userId}:${experimentKey}`).digest();
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    const bucket = hash.readBigUInt64BE(0) % BigInt(totalWeight);

    let cumulative = 0n;
    for (const variant of variants) {
      cumulative += BigInt(variant.weight);
      if (bucket < cumulative) return variant.key;
    }

    // unreachable if weights > 0
    return variants[0]!.key;
  }

  private async isOptedOut(userId: string): Promise<boolean> {
    const rows = await this.dataSource.query<UserPreferencesRow[]>(
      `SELECT preferences FROM users WHERE id = $1`,
      [userId],
    );
    return rows[0]?.preferences.experiments_opted_out === true;
  }
}
