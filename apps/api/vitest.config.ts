import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Generous limits: every file boots an in-process Postgres, which is slow on a busy machine. */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 60_000 },
});
