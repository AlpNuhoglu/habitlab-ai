export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const,
  csrf: () => [...authKeys.all, 'csrf'] as const,
} as const;
