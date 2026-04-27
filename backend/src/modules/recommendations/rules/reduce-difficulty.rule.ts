import type { IRule, RuleContext, RuleResult } from './rule.interface';

export class ReduceDifficultyRule implements IRule {
  evaluate(ctx: RuleContext): RuleResult | null {
    const { completionRate30d } = ctx.habitAnalytics;
    const { difficulty } = ctx.habitConfig;

    if (completionRate30d >= 0.4 || difficulty < 3) return null;

    return {
      category: 'reduce_difficulty',
      title: 'This habit might be too challenging',
      body: `You've completed this habit ${Math.round(completionRate30d * 100)}% of the time over the last 30 days. Consider breaking it into a smaller step to build momentum.`,
      priority: 80,
    };
  }
}
