// @ts-check

export default [
  {
    ignores: ['dist/', 'coverage/'
    ],
  },
  {
    files: ['** /*.ts', '**/*.tsx'
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      'no-console': [
        'error',
        {
          allow: ['error'
          ],
        },
      ],
      'padded-blocks': [
        'error',
        {
          classes: 'always',
        },
      ],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/space-before-function-paren': [
        'error',
        {
          anonymous: 'always',
          named: 'never',
          asyncArrow: 'always',
        },
      ],
    },
  },
]
