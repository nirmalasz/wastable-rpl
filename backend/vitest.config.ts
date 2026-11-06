import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Keep the email-verification flow under test even while it is switched off by default.
    // Blank AI keys so a developer's real key in .env is never used (or billed) by tests;
    // AI tests mock the model instead.
    env: { NODE_ENV: 'test', EMAIL_VERIFICATION: 'on', GEMINI_API_KEY: '', GROQ_API_KEY: '' },
  },
});
