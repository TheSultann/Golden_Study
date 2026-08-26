import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup-env.ts'],
    clearMocks: true,
    fileParallelism: false,
    exclude: [...configDefaults.exclude, 'dist/**'],
  },
});
