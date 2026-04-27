import type { IRule, RuleContext, RuleResult } from './rule.interface';

function argmax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if ((arr[i] ?? 0) > (arr[best] ?? 0)) best = i;
  }
  return best;
}

function preferredHour(preferredTime: string): number {
  // preferredTime is "HH:MM:SS" or "HH:MM"
  return parseInt(preferredTime.slice(0, 2), 10);
}

export class RescheduleRule implements IRule {
  evaluate(ctx: RuleContext): RuleResult | null {
    const { completionByHour } = ctx.habitAnalytics;
    const { preferredTime } = ctx.habitConfig;

    if (!preferredTime) return null;

    const totalCompletions = completionByHour.reduce((a, b) => a + b, 0);
    if (totalCompletions < 5) return null;

    const bestHour = argmax(completionByHour);
    const currentHour = preferredHour(preferredTime);
    const diff = Math.abs(bestHour - currentHour);
    // Wrap-around distance on a 24-hour clock
    const circularDiff = Math.min(diff, 24 - diff);

    if (circularDiff < 2) return null;

    const period = bestHour < 12 ? 'morning' : bestHour < 17 ? 'afternoon' : 'evening';
    const suggestedTime = `${String(bestHour).padStart(2, '0')}:00`;

    return {
      category: 'reschedule',
      title: 'Better time for this habit',
      body: `You tend to complete this habit in the ${period} (around ${suggestedTime}). Consider moving it from ${preferredTime.slice(0, 5)} to match your natural rhythm.`,
      priority: 70,
      actionPayload: { preferred_time: suggestedTime },
    };
  }
}
