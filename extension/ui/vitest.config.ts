import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: resolve(__dirname, 'coverage'),
    },
  },
});
