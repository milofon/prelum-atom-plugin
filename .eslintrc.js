module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: 8,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
      modules: true
    }
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-debugger": "warn",
    "no-console": "warn",
    "no-useless-escape": 0,
    quotes: ["error", "single"]
  },
  globals: {
    atom: true
  },
  env: {
    es6: true,
    node: true,
    browser: true
  }
};
