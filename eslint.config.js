const globals = require('globals');
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/**', 'ios/**', 'android/**', 'node_modules/**', 'assets/**'],
  },
  {
    // Node-side files: build scripts, icon generator, workflow helpers.
    files: ['scripts/**/*.js', 'scripts/**/*.mjs', '*.config.js', 'eslint.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      'import/no-unresolved': 'off',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]);
