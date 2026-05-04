import { z } from 'zod';

import { passwordSchema } from './_password';

export const ResetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export type ResetPasswordValues = z.infer<typeof ResetPasswordSchema>;
