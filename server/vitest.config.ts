import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    fileParallelism: false, // Run integration tests sequentially against isolated local DB
    env: {
      DATABASE_URL: 'file:./dev.db',
      NODE_ENV: 'test',
    },
  },
});
