import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The DB-backed files share one real database and the scheduler's job lock, so running
    // them in parallel makes results depend on timing. One file at a time keeps them stable.
    fileParallelism: false,
    // Keep the email-verification flow under test even while it is switched off by default.
    // Blank AI keys so a developer's real key in .env is never used (or billed) by tests;
    // AI tests mock the model instead.
    env: {
      NODE_ENV: 'test',
      EMAIL_VERIFICATION: 'on',
      GEMINI_API_KEY: '',
      GROQ_API_KEY: '',
      // No real geocoding calls from tests either; geocode.test.ts mocks fetch.
      GEOCODER: 'off',
    },
  },
});
