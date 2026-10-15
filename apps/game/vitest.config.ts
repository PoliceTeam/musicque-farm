import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    // Simulation audits are CPU-heavy and must run one file at a time.
    fileParallelism: false,
    include: ['tests/**/*.test.{ts,tsx}'],
    server: { deps: { inline: ['@chibi-town/renderer-phaser'] } },
  },
});
