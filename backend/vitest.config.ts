import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      WEATHER_RATE_LIMIT_MAX: '1000',
      NOMINATIM_MIN_INTERVAL_MS: '0',
    },
  },
});
