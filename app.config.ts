import { defineConfig } from '@tanstack/start/config';
import tsConfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  vite: {
    plugins: [
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      react({
        babel: {
          plugins: ['macros'],
        },
      }),
    ],
  },
  server: {
    preset: 'vercel',
  },
});
