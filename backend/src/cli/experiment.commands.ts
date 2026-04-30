/* eslint-disable no-console */
import { readFileSync } from 'fs';
import type { DataSource } from 'typeorm';

import type { ExperimentVariant } from '../modules/experiments/entities/experiment.entity';
import type { ExperimentRepository } from '../modules/experiments/experiment.repository';

interface ExperimentSpec {
  key: string;
  name: string;
  description?: string;
  variants: ExperimentVariant[];
  primary_metric: string;
  guardrail_metrics?: string[];
  starts_at?: string;
  ends_at?: string;
}

// §6.5.3 analysis SQL result row
interface AnalysisRow {
  variant: string;
  n: string;
  retained_n: string;
  retention_rate: string;
}

export class ExperimentCommands {
  constructor(
    private readonly dataSource: DataSource,
    private readonly experimentRepo: ExperimentRepository,
  ) {}

  // UC-07 step 2-3: pnpm cli experiment:create -- --file spec.json
  async create(filePath: string): Promise<void> {
    const raw = readFileSync(filePath, 'utf-8');
    const spec = JSON.parse(raw) as ExperimentSpec;

    this.validateSpec(spec);

    const experiment = await this.dataSource.transaction(async (em) => {
      return this.experimentRepo.create(
        {
          key: spec.key,
          name: spec.name,
          ...(spec.description !== undefined && { description: spec.description }),
          variants: spec.variants,
          primaryMetric: spec.primary_metric,
          ...(spec.guardrail_metrics !== undefined && { guardrailMetrics: spec.guardrail_metrics }),
          ...(spec.starts_at !== undefined && { startsAt: new Date(spec.starts_at) }),
          ...(spec.ends_at !== undefined && { endsAt: new Date(spec.ends_at) }),
        },
        em,
      );
    });

    console.log(`Created experiment '${experiment.key}' (id: ${experiment.id}) — status: draft`);
  }

  // UC-07 step 6: pnpm cli experiment:start -- --key exp_key
  async start(key: string): Promise<void> {
    await this.setStatus(key, 'running');
    console.log(`Experiment '${key}' is now running.`);
  }

  // pnpm cli experiment:pause -- --key exp_key
  async pause(key: string): Promise<void> {
    await this.setStatus(key, 'paused');
    console.log(`Experiment '${key}' is now paused.`);
  }

  // UC-07 step 8: pnpm cli experiment:analyze -- --key exp_key
  async analyze(key: string): Promise<void> {
    // §6.5.3 — primary-metric analysis SQL
    const rows = await this.dataSource.query<AnalysisRow[]>(
      `WITH exposure AS (
         SELECT e.user_id,
                (e.payload->>'variantKey') AS variant,
                MIN(e.occurred_at) AS first_exposure_at
         FROM events e
         WHERE e.event_type = 'experiment.exposure'
           AND e.payload->>'experimentKey' = $1
         GROUP BY e.user_id, (e.payload->>'variantKey')
       ),
       retained AS (
         SELECT exp.user_id,
                exp.variant,
                EXISTS (
                  SELECT 1 FROM habit_logs hl
                  WHERE hl.user_id = exp.user_id
                    AND hl.status = 'completed'
                    AND hl.log_date BETWEEN (exp.first_exposure_at::date + 6)
                                        AND (exp.first_exposure_at::date + 8)
                ) AS is_retained
         FROM exposure exp
         WHERE exp.first_exposure_at < now() - interval '8 days'
       )
       SELECT variant,
              COUNT(*)                                               AS n,
              SUM(CASE WHEN is_retained THEN 1 ELSE 0 END)          AS retained_n,
              ROUND(
                SUM(CASE WHEN is_retained THEN 1 ELSE 0 END)::numeric / COUNT(*), 4
              )                                                      AS retention_rate
       FROM retained
       GROUP BY variant
       ORDER BY variant`,
      [key],
    );

    if (rows.length === 0) {
      console.log(`No exposure data found for experiment '${key}'.`);
      return;
    }

    console.log(`\nExperiment: ${key}`);
    console.log('─'.repeat(60));
    console.log(`${'Variant'.padEnd(20)} ${'N'.padStart(8)} ${'Retained'.padStart(10)} ${'Rate'.padStart(8)}`);
    console.log('─'.repeat(60));

    const parsed = rows.map((r) => ({
      variant: r.variant,
      n: parseInt(r.n, 10),
      retainedN: parseInt(r.retained_n, 10),
      rate: parseFloat(r.retention_rate),
    }));

    for (const row of parsed) {
      console.log(
        `${row.variant.padEnd(20)} ${String(row.n).padStart(8)} ${String(row.retainedN).padStart(10)} ${row.rate.toFixed(4).padStart(8)}`,
      );
    }

    // z-test between first two variants (control vs treatment)
    if (parsed.length >= 2) {
      const control = parsed[0]!;
      const treatment = parsed[1]!;
      const zResult = this.twoSampleZTest(
        control.retainedN, control.n,
        treatment.retainedN, treatment.n,
      );

      console.log('\n─'.repeat(60));
      console.log(`Two-sample z-test: ${control.variant} vs ${treatment.variant}`);
      console.log(`  Δ retention rate : ${(zResult.diff * 100).toFixed(2)}pp`);
      console.log(`  z-statistic      : ${zResult.z.toFixed(4)}`);
      console.log(`  95% CI           : [${(zResult.ci[0]! * 100).toFixed(2)}pp, ${(zResult.ci[1]! * 100).toFixed(2)}pp]`);
      console.log(`  Significant (p<.05): ${Math.abs(zResult.z) >= 1.96 ? 'YES' : 'NO'}`);
    }
  }

  private async setStatus(
    key: string,
    status: 'running' | 'paused' | 'completed' | 'archived',
  ): Promise<void> {
    const experiment = await this.experimentRepo.findByKey(key);
    if (!experiment) throw new Error(`Experiment '${key}' not found`);

    await this.dataSource.transaction(async (em) => {
      await this.experimentRepo.updateStatus(key, status, em);
    });
  }

  // §6.5.3 — z-test for two proportions
  private twoSampleZTest(
    r1: number, n1: number,
    r2: number, n2: number,
  ): { z: number; diff: number; ci: [number, number] } {
    const p1 = n1 > 0 ? r1 / n1 : 0;
    const p2 = n2 > 0 ? r2 / n2 : 0;
    const diff = p2 - p1;

    const pPool = (r1 + r2) / (n1 + n2);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
    const z = se > 0 ? diff / se : 0;

    const seDiff = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
    const ci: [number, number] = [diff - 1.96 * seDiff, diff + 1.96 * seDiff];

    return { z, diff, ci };
  }

  private validateSpec(spec: ExperimentSpec): void {
    if (!spec.key || !spec.name || !Array.isArray(spec.variants) || spec.variants.length < 2) {
      throw new Error('Invalid experiment spec: key, name, and at least 2 variants required');
    }
    if (!spec.primary_metric) {
      throw new Error('Invalid experiment spec: primary_metric is required');
    }
    for (const v of spec.variants) {
      if (!v.key || typeof v.weight !== 'number' || v.weight <= 0) {
        throw new Error(`Invalid variant: each variant must have key and positive weight`);
      }
    }
  }
}

