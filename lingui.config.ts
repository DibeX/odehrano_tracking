import { defineConfig } from '@lingui/cli';

export default defineConfig({
  locales: ['en', 'cs'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
    },
  ],
  format: 'po',
});
