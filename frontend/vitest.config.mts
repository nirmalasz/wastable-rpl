import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/** Unit and component tests for the Next.js app (run with `npm test -w frontend`). */
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Same alias as tsconfig.json "paths".
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    env: { NEXT_PUBLIC_API_URL: 'http://api.test/api' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/app/**/{layout,loading,error}.tsx'],
      reporter: ['text-summary', 'html'],
    },
  },
});
