import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Vitest runs unit tests for the category-agnostic model-library core and other
// pure services. Tests run in a Node environment (no Electron); core modules must
// not import 'electron', so nothing here shims it.
export default defineConfig({
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
  },
})
