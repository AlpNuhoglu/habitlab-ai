export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

const LABELS: Record<PasswordStrength, string> = {
  0: '',
  1: 'Weak',
  2: 'Fair',
  3: 'Good',
  4: 'Strong',
};

const COLORS: Record<PasswordStrength, string> = {
  0: 'bg-gray-200',
  1: 'bg-red-500',
  2: 'bg-orange-400',
  3: 'bg-yellow-400',
  4: 'bg-green-500',
};

export function scorePassword(password: string): PasswordStrength {
  if (!password) return 0;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;

  return Math.min(score, 4) as PasswordStrength;
}

export function strengthLabel(score: PasswordStrength): string {
  return LABELS[score];
}

export function strengthColor(score: PasswordStrength): string {
  return COLORS[score];
}
