import type { HabitAnalytics } from '../analytics/entities/habit-analytics.entity';
import type { LLMPrompt } from '../../infrastructure/llm/llm-provider.interface';

// §6.3.2 — verbatim system prompt (only {{locale}} is substituted)
const SYSTEM_TEMPLATE = `You are a friendly, concise habit coach. You write short, specific,
actionable suggestions to help a user improve the consistency of their
personal habits.

Constraints, in order of strictness:
1. You MUST NOT provide medical, psychological, or therapeutic advice.
   You are a productivity/behavioral coach, not a clinician.
2. You MUST NOT make claims about physical or mental health outcomes.
3. You MUST NOT use sensationalist or fear-based framing.
4. Your output MUST be at most 2 sentences and at most 280 characters total.
5. Your output MUST be warm but factual. Avoid emojis.
6. You MUST write in the user's locale: {{locale}} ("en" = English, "tr" = Turkish).

Reply with ONLY the two-sentence suggestion. No preamble, no sign-off.`;

// §6.3.2 — verbatim user prompt template
const USER_TEMPLATE = `Habit name: {{habitName}}
Difficulty (1-5): {{difficulty}}
Preferred time: {{preferredTime}}
Last 30 days:
  - Completion rate: {{completionRate30d}}%
  - Best weekday: {{bestWeekdayName}}
  - Worst weekday: {{worstWeekdayName}}
  - Best hour of day: {{bestHourOfDay}}
  - Current streak: {{currentStreak}} days
  - Longest ever streak: {{longestStreak}} days

Rule trigger: {{ruleCategory}}
(possible values: reschedule, reduce_difficulty, streak_celebration,
  encouragement_after_skip, consistency_reinforcement)

Based on the data above, write a two-sentence suggestion that addresses
the trigger. Be specific: reference the pattern in the data.`;

const WEEKDAY_NAMES: Record<string, string[]> = {
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  tr: ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'],
};

function weekdayName(index: number, locale: string): string {
  const names = WEEKDAY_NAMES[locale] ?? WEEKDAY_NAMES['en']!;
  return names[index] ?? names[index % 7]!;
}

function bestIndex(arr: number[]): number | null {
  const max = Math.max(...arr);
  if (max === 0) return null;
  return arr.indexOf(max);
}

function worstIndex(arr: number[]): number | null {
  const nonZero = arr.filter((v) => v > 0);
  if (nonZero.length === 0) return null;
  const min = Math.min(...nonZero);
  return arr.indexOf(min);
}

export interface PromptBuilderInput {
  analytics: HabitAnalytics;
  habitName: string;
  difficulty: number;
  preferredTime: string | null;
  locale: string;
  ruleCategory: string;
}

export function buildLlmPrompt(input: PromptBuilderInput): LLMPrompt {
  const { analytics, habitName, difficulty, preferredTime, locale, ruleCategory } = input;

  const bestWeekdayIdx = bestIndex(analytics.completionByWeekday);
  const worstWeekdayIdx = worstIndex(analytics.completionByWeekday);
  const bestHourIdx = bestIndex(analytics.completionByHour);

  const bestWeekdayName =
    bestWeekdayIdx !== null ? weekdayName(bestWeekdayIdx, locale) : 'no clear pattern';
  const worstWeekdayName =
    worstWeekdayIdx !== null ? weekdayName(worstWeekdayIdx, locale) : 'no clear pattern';
  const bestHourOfDay = bestHourIdx !== null ? `${bestHourIdx}:00` : 'no clear pattern';

  const completionPct = Math.round(Number(analytics.completionRate30d) * 100);

  const system = SYSTEM_TEMPLATE.replace('{{locale}}', locale);

  const user = USER_TEMPLATE
    .replace('{{habitName}}', habitName)
    .replace('{{difficulty}}', String(difficulty))
    .replace('{{preferredTime}}', preferredTime ?? 'not set')
    .replace('{{completionRate30d}}', String(completionPct))
    .replace('{{bestWeekdayName}}', bestWeekdayName)
    .replace('{{worstWeekdayName}}', worstWeekdayName)
    .replace('{{bestHourOfDay}}', bestHourOfDay)
    .replace('{{currentStreak}}', String(analytics.currentStreak))
    .replace('{{longestStreak}}', String(analytics.longestStreak))
    .replace('{{ruleCategory}}', ruleCategory);

  return { system, user };
}
