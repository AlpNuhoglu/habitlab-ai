import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Enter a valid email address').max(254),
  // Don't enforce password strength rules on login — user may have a pre-policy password
  password: z.string().min(1, 'Password is required'),
});

export type LoginValues = z.infer<typeof LoginSchema>;
