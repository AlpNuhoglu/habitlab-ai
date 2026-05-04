import { z } from 'zod';

export const RequestResetSchema = z.object({
  email: z.string().email('Enter a valid email address').max(254),
});

export type RequestResetValues = z.infer<typeof RequestResetSchema>;
