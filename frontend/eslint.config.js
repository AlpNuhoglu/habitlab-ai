// @ts-check
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    // features/ must access the event sink only through use-emit-event — never directly.
    // This keeps the sink's internal modules (buffer, flusher, IDB queue) encapsulated.
    files: ['src/features/**/*.{ts,tsx}'],
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
