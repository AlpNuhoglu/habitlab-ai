import type { IRule, RuleContext, RuleResult } from './rule.interface';

export class EncouragementAfterSkipRule implements IRule {
  evaluate(ctx: RuleContext): RuleResult | null {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setUTCDate(today.getUTCDate() - 3);
    const cutoff = threeDaysAgo.toISOString().slice(0, 10);

    const recentSkips = ctx.recentLogs.filter((l) => l.status === 'skipped' && l.logDate >= cutoff);

    if (recentSkips.length < 2) return null;

    return {
      category: 'encouragement_after_skip',
      title: 'Getting back on track',
      body: `You've skipped this habit ${recentSkips.length} times in the last 3 days. Small steps count — even 5 minutes today will restart your momentum.`,
      priority: 75,
    };
  }
}
