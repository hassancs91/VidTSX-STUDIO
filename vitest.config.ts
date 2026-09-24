import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Vitest runs unit tests for the category-agnostic model-library core and other
// pure services. Tests run in a Node environment (no Electron); core modules must
// not import 'electron', so nothing here shims it.
export default defineConfig({
  // Component smoke tests render with the automatic JSX runtime (no React import).
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@main': resolve('src/main'),
      '@logging': resolve('src/logging'),
      '@audio-engine': resolve('src/audio-engine'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The Content Safety dev bypass is opt-in per shell (dev-bypass.ts). Force
    // it off here so a developer's shell can never flip the golden policy
    // tests; the bypass's own tests stub it back on.
    env: { VIDTSX_DEV_DISABLE_CONTENT_SAFETY: '' },
  },
})
