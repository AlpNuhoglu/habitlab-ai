import { z } from 'zod';

// FR-001: ≥8 chars, ≥1 letter, ≥1 digit — must match backend ValidationPipe rules
export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters required')
  .regex(/[a-zA-Z]/, 'At least one letter required')
  .regex(/[0-9]/, 'At least one digit required');
