import type { HabitColor } from '../types';

export const HABIT_COLOR_CLASSES: Record<
  HabitColor,
  { bg: string; text: string; ring: string; light: string }
> = {
  slate:   { bg: 'bg-slate-500',   text: 'text-slate-600',   ring: 'ring-slate-400',   light: 'bg-slate-100'   },
  blue:    { bg: 'bg-blue-500',    text: 'text-blue-600',    ring: 'ring-blue-400',    light: 'bg-blue-100'    },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-400', light: 'bg-emerald-100' },
  amber:   { bg: 'bg-amber-500',   text: 'text-amber-600',   ring: 'ring-amber-400',   light: 'bg-amber-100'   },
  rose:    { bg: 'bg-rose-500',    text: 'text-rose-600',    ring: 'ring-rose-400',    light: 'bg-rose-100'    },
  violet:  { bg: 'bg-violet-500',  text: 'text-violet-600',  ring: 'ring-violet-400',  light: 'bg-violet-100'  },
};

export const HABIT_COLORS: HabitColor[] = ['slate', 'blue', 'emerald', 'amber', 'rose', 'violet'];
