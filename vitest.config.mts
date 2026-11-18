import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname) } },
  test: { environment: 'node', env: { VX_DB: 'memoria' }, testTimeout: 30_000, hookTimeout: 60_000 },
});
