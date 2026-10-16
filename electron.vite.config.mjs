import { defineConfig } from 'electron-vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// D9 (TSX_BUILDER_DESIGN.md P3 part 6): `VIDTSX_DEV_PROD_REACT=1 npm run dev`
// runs the renderer on PRODUCTION React, so a Studio shot built with three /
// R3F plays in the editor under `npm run dev` (a builder vN.tsx inlines R3F's
// production reconciler, which needs production React: "dispatcher.getOwner is
// not a function" otherwise). Read in electron-vite 5.0.0 / Vite 7.3.2:
// - electron-vite sets NODE_ENV=development before it loads this config
//   (electron-vite lib-q6ns0vZr.js:1516), so a shell NODE_ENV or --mode is lost.
// - Pre-bundled deps (react, react-dom, scheduler) take NODE_ENV from the
//   optimizer's own define, which holds only that key; esbuildOptions is spread
//   after it and is part of the dep hash (vite config.js:32094, :32120,
//   :32353-32368): this define is the lever.
// - App JSX compiles with jsxDev: !isProduction (config.js:35616), and
//   production react-jsx-dev-runtime has jsxDEV = undefined, so jsxDev goes off.
// - Its own dep cache, so flipping the switch does not re-optimize each time.
// import.meta.env.DEV stays true (feature flags, the content-safety dev bypass).
// Packaged builds are unchanged: `electron-vite build` is production already.
const devProdReact = process.env.VIDTSX_DEV_PROD_REACT === '1'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      sourcemap: true,
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          'embedding-worker': resolve('src/embedding-engine/worker.ts'),
          'content-safety-worker': resolve('src/content-safety-engine/worker.ts'),
          'analysis-worker': resolve('src/analysis-engine/worker.ts'),
          'bundle-worker': resolve('src/main/services/bundle-worker.ts'),
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
    esbuild: devProdReact ? { jsx: 'automatic', jsxDev: false } : {
      jsx: 'automatic'
    },
    // Absolute: a relative cacheDir resolves against the renderer root (src/renderer).
    ...(devProdReact ? { cacheDir: resolve('node_modules/.vite-prod-react') } : {}),
    plugins: [tailwindcss()],
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
      include: ['reactflow', 'd3-transition'],
      ...(devProdReact ? { esbuildOptions: { define: { 'process.env.NODE_ENV': '"production"' } } } : {}),
    }
  }
})
