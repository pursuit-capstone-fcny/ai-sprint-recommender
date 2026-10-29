import js from '@eslint/js';
import globals from 'globals';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'build', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: [
      'apps-script/index.ts',
      'apps-script/test-setup.ts',
      'apps-script/catalog-sheet.ts',
      'apps-script/usage-sheet.ts',
      'apps-script/analytics-sheet.ts',
      'apps-script/analytics-snapshots.ts',
    ],
    languageOptions: {
      globals: {
        PropertiesService: 'readonly',
        SpreadsheetApp: 'readonly',
        LockService: 'readonly',
        ContentService: 'readonly',
        Utilities: 'readonly',
        ScriptApp: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    ...jsxA11y.flatConfigs.recommended,
    files: ['**/*.{tsx,jsx}'],
  },
);
