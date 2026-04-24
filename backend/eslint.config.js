// @ts-check
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-require-imports': 'error',
    },
  },
  // Controllers and services use emitDecoratorMetadata: NestJS's ValidationPipe and
  // DI container need class references at runtime for @Body() params and constructor
  // injection. ESLint can't detect this, so we allow value imports in these files.
  {
    files: ['src/**/*.controller.ts', 'src/**/*.service.ts', 'src/**/*.guard.ts', 'src/**/*.filter.ts', 'src/**/*.module.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'no-type-imports' },
      ],
    },
  },
];
