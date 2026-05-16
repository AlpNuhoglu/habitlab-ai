// @ts-check
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    // recharts must only be imported through lib/recharts/primitives.ts.
    // This keeps the library API surface narrow and makes a future swap a one-file change.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/recharts/primitives.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'recharts',
              message: 'Import recharts via lib/recharts/primitives.ts only.',
            },
          ],
        },
      ],
    },
  },
  {
    // features/ must access the event sink only through use-emit-event — never directly.
    // This keeps the sink's internal modules (buffer, flusher, IDB queue) encapsulated.
    // Exception: features/experiments internals (ExperimentsBoundary, VariantSlot) call
    // enqueue() directly because they predate the full abstraction and own the event types.
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['src/features/experiments/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/lib/events/client-event',
                '**/lib/events/event-sink',
                '**/lib/events/event-flusher',
                '**/lib/events/offline-queue',
              ],
              message:
                'Import from lib/events through use-emit-event only: import { useEmitEvent } from "../../../lib/events/use-emit-event"',
            },
          ],
        },
      ],
    },
  },
  {
    // useAllAssignments is an experiments-internal hook.
    // Feature code must use useVariant() or <VariantSlot> instead.
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['src/features/experiments/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/experiments/api/use-all-assignments*'],
              message:
                'Do not import useAllAssignments directly — use useVariant() or <VariantSlot> from features/experiments.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off', // React 17+ JSX transform — import gerekmez
      'react/prop-types': 'off', // TypeScript halleder
    },
  },
];
