export function streakBonusMultiplier(streakDays: number): number {
  if (streakDays > 30) return 2.0;
  if (streakDays > 7)  return 1.5;
  return 1.0;
}
if (streakDays > 7) return streakDays <= 30 ? 1.5 : 2.0;
