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
    // navigator.serviceWorker.* must only be accessed from sw-registration.ts.
    // All other SW access goes through that module to keep the boundary mechanical.
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/features/notifications/lib/sw-registration.ts',
      'src/service-worker/**',
      // DeviceList needs pushManager.getSubscription() for unsubscribe flow
      'src/features/notifications/components/DeviceList.tsx',
      'src/features/notifications/components/MasterPushToggle.tsx',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[object.property.name="serviceWorker"]',
          message:
            'Access navigator.serviceWorker only through features/notifications/lib/sw-registration.ts.',
        },
      ],
    },
  },
  {
    // Notification.requestPermission() must only be called from use-push-permission.ts.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/features/notifications/hooks/use-push-permission.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.object.name="Notification"][callee.property.name="requestPermission"]',
          message:
            'Notification.requestPermission() must only be called from features/notifications/hooks/use-push-permission.ts.',
        },
      ],
    },
  },
  {
    // SW handler/entry files must not import from src/features/ or src/lib/ — those modules
    // use DOM APIs unavailable in the ServiceWorker context.
    // (service-worker/lib/ is the SW-safe lib; that import resolves to ../lib/ which is fine.)
    files: ['src/service-worker/sw.ts', 'src/service-worker/handlers/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../features/**', '../../lib/**', '../../../features/**'],
              message:
                'SW files may not import from src/features/ or src/lib/ — DOM APIs are unavailable in the SW context. Use service-worker/lib/ helpers instead.',
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
