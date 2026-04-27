import type { IRule, RuleContext, RuleResult } from './rule.interface';

export class StreakCelebrationRule implements IRule {
  evaluate(ctx: RuleContext): RuleResult | null {
    const { currentStreak } = ctx.habitAnalytics;

    if (currentStreak <= 0 || currentStreak % 7 !== 0) return null;

    return {
      category: 'streak_celebration',
      title: `${currentStreak}-day streak! 🎉`,
      body: `You've kept this habit going for ${currentStreak} days in a row. That's a real achievement — keep it up!`,
      priority: 60,
    };
  }
}
