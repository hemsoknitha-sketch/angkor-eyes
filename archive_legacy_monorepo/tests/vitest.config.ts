import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests are fast and always run. Integration tests need Docker
    // (Testcontainers) and git; they skip gracefully when Docker is absent.
    include: ['unit/**/*.test.ts', 'integration/**/*.test.ts'],
    environment: 'node',
    // Integration containers can take a while to pull on first run.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Run integration tests serially: they share the Docker daemon and
    // temp git repos, and parallel runs make failures harder to read.
    poolOptions: {
      threads: { singleThread: false },
    },
    coverage: {
      provider: 'v8',
      include: ['unit/**/*.ts', 'integration/**/*.ts'],
    },
  },
});
