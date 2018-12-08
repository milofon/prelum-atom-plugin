module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 8,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
      modules: true,
    },
  },
  extends: ['eslint:recommended', 'prettier', 'prettier/standard'],
  rules: {
    'no-debugger': 'warn',
    'no-console': 'warn',
    'no-useless-escape': 0,
  },
  globals: {
    atom: true,
  },
  env: {
    es6: true,
    node: true,
    browser: true,
  },
};
