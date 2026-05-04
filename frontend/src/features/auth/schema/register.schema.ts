import { z } from 'zod';

import { passwordSchema } from './_password';

export const RegisterSchema = z
  .object({
    email: z.string().email('Enter a valid email address').max(254),
    password: passwordSchema,
    passwordConfirm: z.string(),
    // Backend field: consentGiven. Mapped in mutation hook.
    acceptTos: z.boolean().refine((v) => v === true, {
      message: 'You must accept the terms to continue',
    }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Passwords do not match',
  });

export type RegisterValues = z.infer<typeof RegisterSchema>;
