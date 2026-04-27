import type { IRule, RuleContext, RuleResult } from './rule.interface';

export class ConsistencyReinforcementRule implements IRule {
  evaluate(ctx: RuleContext): RuleResult | null {
    const { completionRate30d, currentStreak } = ctx.habitAnalytics;

    if (completionRate30d <= 0.8 || currentStreak <= 14) return null;

    return {
      category: 'consistency_reinforcement',
      title: "You're on fire with this habit",
      body: `${Math.round(completionRate30d * 100)}% completion rate and a ${currentStreak}-day streak — you've built a genuine routine. Consider leveling up the challenge.`,
      priority: 65,
    };
  }
}
