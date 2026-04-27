import { Injectable } from '@nestjs/common';

import { ConsistencyReinforcementRule } from './rules/consistency-reinforcement.rule';
import { EncouragementAfterSkipRule } from './rules/encouragement-after-skip.rule';
import { ReduceDifficultyRule } from './rules/reduce-difficulty.rule';
import { RescheduleRule } from './rules/reschedule.rule';
import { RetroactiveLoggingReminderRule } from './rules/retroactive-logging-reminder.rule';
import { StreakCelebrationRule } from './rules/streak-celebration.rule';
import { IRule, RuleContext, RuleResult } from './rules/rule.interface';

@Injectable()
export class RuleEngineService {
  private readonly rules: IRule[] = [
    new RescheduleRule(),
    new ReduceDifficultyRule(),
    new StreakCelebrationRule(),
    new EncouragementAfterSkipRule(),
    new ConsistencyReinforcementRule(),
    new RetroactiveLoggingReminderRule(),
  ];

  evaluate(ctx: RuleContext): RuleResult[] {
    return this.rules.map((r) => r.evaluate(ctx)).filter((r): r is RuleResult => r !== null);
  }
}
