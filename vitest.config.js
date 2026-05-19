import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    setupFiles:  ['./tests/setup.js'],
    include:     ['tests/unit/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include:  ['assets/calendar-utils.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
