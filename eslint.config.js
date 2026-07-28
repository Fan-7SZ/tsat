// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores([
  'dist',
  'coverage',
  'playwright-report',
  'test-results',
  'storybook-static',
]), {
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  rules: {
    // Underscore prefix marks intentionally unused (interface-conformance args).
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
    ],
  },
}, {
  // React Cosmos fixtures export fixture maps / elements, not components.
  files: ['**/*.fixture.{ts,tsx}'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, {
  // shadcn/ui files export variants/hooks alongside components by design.
  files: ['src/components/ui/**'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, {
  // Playwright fixtures: the `use` callback is not a React hook.
  files: ['test/e2e/**'],
  rules: {
    'react-hooks/rules-of-hooks': 'off',
  },
}, ...storybook.configs["flat/recommended"]])
