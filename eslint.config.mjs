import eslint from '@eslint/js'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'

export default typescriptEslint.config(
  {
    ignores: [
      '**/.output/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      '**/routeTree.gen.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  eslint.configs.recommended,
  ...typescriptEslint.configs.strictTypeChecked.map((configuration) => ({
    ...configuration,
    files: ['**/*.ts', '**/*.tsx'],
  })),
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'id-length': ['error', { min: 2, exceptions: ['T'] }],
    },
  },
  {
    files: ['**/*.config.ts', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
)
