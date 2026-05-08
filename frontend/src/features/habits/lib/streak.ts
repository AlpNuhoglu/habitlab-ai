export function formatStreak(days: number): string {
  if (days === 0) return 'No streak';
  return `${days}-day streak`;
}

export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}
