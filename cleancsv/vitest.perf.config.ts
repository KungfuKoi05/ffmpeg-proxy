import { defineConfig } from 'vitest/config'

// Performance checks run on demand (npm run perf); they are slow and machine-dependent,
// so they are kept out of the normal test run.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.perf.test.ts'],
    testTimeout: 300_000,
    silent: false,
    disableConsoleIntercept: true,
  },
})
