import { defineConfig } from 'electron-vite'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { resolve } from 'path'

const sentryPluginConfig = () =>
  process.env.SENTRY_AUTH_TOKEN
    ? sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
      })
    : null

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      sourcemap: true,
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'embedding-worker': resolve('src/embedding-engine/worker.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          // Point esbuild at its asar.unpacked .exe BEFORE any require() runs.
          // esbuild reads ESBUILD_BINARY_PATH at module-load (lib/main.js:1604), so
          // setting it from inside the bundle is too late — rollup hoists the
          // require("esbuild") above any side-effect code.
          banner: (chunk) => chunk.fileName === 'index.js'
            ? "try { if (process.platform === 'win32' && require('electron').app.isPackaged) { process.env.ESBUILD_BINARY_PATH = require('path').join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'); } } catch (e) {}"
            : '',
        },
      },
    },
    plugins: [sentryPluginConfig()].filter(Boolean),
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@main': resolve('src/main'),
        '@logging': resolve('src/logging'),
        '@audio-engine': resolve('src/audio-engine'),
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          preload: resolve('src/preload/preload.ts'),
          'preview-preload': resolve('src/preload/preview-preload.ts'),
        },
        output: {
          entryFileNames: '[name].js',
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@audio-engine': resolve('src/audio-engine'),
      }
    }
  },
  renderer: {
    build: {
      outDir: 'out/renderer',
      sourcemap: true,
    },
    esbuild: {
      jsx: 'automatic'
    },
    plugins: [tailwindcss(), sentryPluginConfig()].filter(Boolean),
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer'),
        '@features': resolve('src/features')
      }
    },
    optimizeDeps: {
      exclude: [],
      // reactflow 11's d3-zoom calls selection.interrupt(), which is a side-effect
      // patch that d3-transition adds to d3-selection's prototype. Force-including
      // both ensures Vite's dep pre-bundling preserves that side-effect import
      // instead of tree-shaking it away.
      include: ['reactflow', 'd3-transition']
    }
  }
})
