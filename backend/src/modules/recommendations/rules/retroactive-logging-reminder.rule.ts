import type { IRule, RuleContext, RuleResult } from './rule.interface';

export class RetroactiveLoggingReminderRule implements IRule {
  evaluate(ctx: RuleContext): RuleResult | null {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setUTCDate(today.getUTCDate() - 3);
    const cutoff = threeDaysAgo.toISOString().slice(0, 10);

    const recentActivity = ctx.recentLogs.filter((l) => l.logDate >= cutoff);

    if (recentActivity.length > 0) return null;

    return {
      category: 'retroactive_logging_reminder',
      title: 'Forgot to log this habit?',
      body: 'No activity recorded for this habit in the last 3 days. You can log past completions retroactively to keep your streak accurate.',
      priority: 85,
    };
  }
}
