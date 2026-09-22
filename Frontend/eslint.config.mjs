import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const restricted = (message, groups) => [
  'error',
  {
    patterns: groups.map((group) => ({ group, message })),
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      'web/.expo/**',
      'web/dist/**',
      'mobile/.expo/**',
      'mobile/ios/**',
      'mobile/android/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', prefer: 'type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['web/app/**/*.{ts,tsx}', 'mobile/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restricted(
        'Route wrappers may import Expo Router and shared feature/application entry points only.',
        [
          ['@snapworth/shared/services', '@snapworth/shared/services/**'],
          ['@snapworth/shared/ports', '@snapworth/shared/ports/**'],
          ['@snapworth/shared/data', '@snapworth/shared/data/**'],
          ['@snapworth/shared/adapters', '@snapworth/shared/adapters/**'],
          ['**/shared/src/services/**', '**/shared/src/ports/**'],
          ['**/shared/src/data/**', '**/shared/src/adapters/**'],
          ['@supabase/**', '**/supabase/**'],
        ],
      ),
    },
  },
  {
    files: ['shared/src/features/**/views/**/*.{ts,tsx}', 'shared/src/features/**/*View.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restricted(
        'Views consume feature state and stateless UI; infrastructure is injected below them.',
        [
          ['../../../data/**', '../../../adapters/**'],
          ['../../data/**', '../../adapters/**'],
          ['@supabase/**', '**/supabase/**'],
        ],
      ),
    },
  },
  {
    files: ['shared/src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restricted(
        'Stateless components may depend only on domain types and design foundations.',
        [
          ['../../features/**', '../../services/**', '../../ports/**'],
          ['../../data/**', '../../adapters/**'],
          ['@supabase/**', '**/supabase/**'],
        ],
      ),
    },
  },
  {
    files: ['shared/src/services/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restricted(
        'Services depend inward on ports and domain types, never concrete infrastructure or views.',
        [
          ['../data/**', '../adapters/**', '../features/**', '../components/**'],
          ['@supabase/**', '**/supabase/**'],
        ],
      ),
    },
  },
  {
    files: ['shared/src/ports/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restricted(
        'Ports are inward-owned contracts and cannot depend on services, presentation, or infrastructure.',
        [
          ['../services/**', '../features/**', '../components/**'],
          ['../data/**', '../adapters/**'],
          ['@supabase/**', '**/supabase/**'],
        ],
      ),
    },
  },
  {
    files: ['shared/src/{data,adapters}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restricted(
        'Infrastructure implements ports and cannot depend on services, providers, views, or components.',
        [['../../services/**', '../../features/**', '../../components/**']],
      ),
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      'scripts/**/*.{js,mjs,cjs}',
      '*.config.{js,mjs,cjs,ts}',
      'web/*.config.{js,mjs,cjs,ts}',
      'mobile/*.config.{js,mjs,cjs,ts}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['web/**/*.{ts,tsx}', 'mobile/**/*.{ts,tsx}', 'shared/src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/*.property.test.{ts,tsx}'],
    languageOptions: {
      globals: globals.jest,
    },
  },
);
