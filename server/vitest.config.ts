import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    fileParallelism: false, // Run integration tests sequentially against local DB
  },
});
