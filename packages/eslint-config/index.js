import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import globals from 'globals';
import typescriptEslint from 'typescript-eslint';

const javascriptFiles = ['**/*.{js,mjs,cjs}'];
const typescriptFiles = ['**/*.{ts,mts,cts,tsx}'];
const webFiles = ['apps/web/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'];

function scoped(configs, files) {
  return configs.map((config) => ({ ...config, files }));
}

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/out/**',
    '**/coverage/**',
    '**/generated/**',
    '**/*.tsbuildinfo',
    '**/next-env.d.ts',
  ]),
  { ...js.configs.recommended, files: javascriptFiles },
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['scripts/e2e-canvas.mjs'],
    languageOptions: { globals: globals.browser },
  },
  ...scoped(typescriptEslint.configs.recommended, typescriptFiles),
  ...scoped(nextVitals, webFiles),
  ...scoped(nextTypescript, webFiles),
]);
