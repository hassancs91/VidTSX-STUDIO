import path from 'path';
import { bundle } from '@remotion/bundler';

/**
 * Utility-process entry: runs @remotion/bundler's webpack compile off the main
 * process. Webpack is CPU-bound JS and bundle() also calls process.chdir —
 * in the main process both stall the event loop, which freezes every window
 * (the render-start "whole UI locks for seconds" papercut). worker_threads
 * can't host it either: process.chdir throws inside a worker thread.
 *
 * Spawned by remotion-bundler.ts via utilityProcess.fork; env is inherited, so
 * the packaged-build ESBUILD_BINARY_PATH set by the index.js banner carries
 * over.
 */

export interface BundleWorkerRequest {
  entryPoint: string;
  outDir: string;
  /** Must be a real OS directory — webpack chdirs into it, and chdir does NOT
   *  go through Electron's asar shim (project root in dev, resources/ packaged). */
  rootDir: string;
  /** app.getAppPath() — node_modules and app-source aliases resolve from here
   *  (project root in dev; asar root packaged, readable via the asar shim). */
  appPath: string;
}

export type BundleWorkerReply =
  | { type: 'progress'; percent: number }
  | { type: 'done'; bundlePath: string }
  | { type: 'error'; message: string };

const port = process.parentPort;

function reply(message: BundleWorkerReply): void {
  port.postMessage(message);
}

async function run(request: BundleWorkerRequest): Promise<void> {
  try {
    const bundlePath = await bundle({
      entryPoint: request.entryPoint,
      outDir: request.outDir,
      rootDir: request.rootDir,
      webpackOverride: (config) => {
        config.resolve = config.resolve || {};
        config.resolve.modules = [
          ...(config.resolve.modules || ['node_modules']),
          path.join(request.appPath, 'node_modules'),
        ];
        // App-source path aliases, mirroring electron.vite.config — let
        // generated render entries resolve app `@shared/...`/`@features/...`
        // imports. Harmless for Creator user-TSX bundling — user code never
        // uses these prefixes, so nothing else resolves differently.
        config.resolve.alias = {
          ...(config.resolve.alias || {}),
          '@shared': path.join(request.appPath, 'src', 'shared'),
          '@features': path.join(request.appPath, 'src', 'features'),
          '@renderer': path.join(request.appPath, 'src', 'renderer'),
        };
        return config;
      },
      onProgress: (percent) => reply({ type: 'progress', percent }),
    });
    reply({ type: 'done', bundlePath });
  } catch (err) {
    reply({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

port.on('message', (event) => {
  void run(event.data as BundleWorkerRequest);
});
