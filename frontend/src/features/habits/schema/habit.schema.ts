import { z } from 'zod';

const HabitBaseSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Max 120 characters'),
  description: z.string().trim().max(500, 'Max 500 characters').optional().nullable(),
  frequencyType: z.enum(['daily', 'weekly']),
  weekdayMask: z.number().int().min(0).max(127).optional().nullable(),
  preferredTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM format (24h)')
    .optional()
    .nullable(),
  difficulty: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
});

export const HabitSchema = HabitBaseSchema.refine(
  (v) => v.frequencyType !== 'weekly' || (v.weekdayMask != null && v.weekdayMask > 0),
  { message: 'Select at least one day', path: ['weekdayMask'] },
);

export type HabitFormValues = z.infer<typeof HabitBaseSchema>;

export const UpdateHabitSchema = HabitBaseSchema.partial();
export type UpdateHabitFormValues = z.infer<typeof UpdateHabitSchema>;
