import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Keep the email-verification flow under test even while it is switched off by default.
    env: { NODE_ENV: 'test', EMAIL_VERIFICATION: 'on' },
  },
});
