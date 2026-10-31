import { logEngine } from '../../logging/log-engine';
import { listBundleCompositions } from './bundle-compositions';

const log = logEngine.createLogger('Bundler');
import { createHash } from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import express from 'express';
import type { Express, RequestHandler } from 'express';
import type { Server } from 'http';
import { app, utilityProcess } from 'electron';
import type { BundleWorkerReply, BundleWorkerRequest } from './bundle-worker';
import { generateWrapper, cleanupWrapper } from './composition-wrapper';
import { materializeAbsoluteStaticFiles } from './remotion-static-files';
import { registerFontProxy } from './font-proxy';
import { ASSET_ROOT_ROUTE, serveAssetRoot } from './asset-roots';
import { ASSET_ROUTE_EXTENSIONS } from './asset-route-extensions';
import { getAppRoot } from '../utils/paths';
import {
  BUNDLE_ROUTE,
  bundleIdFromUrl,
  bundlePublicPath,
  bundleServeUrl,
  isBundleId,
  makeBundleId,
} from './bundle-serve-paths';
import { bundlesMadeInside, pruneBundleFolders, type MadeBundle } from './bundle-cache-prune';

// Types
export interface CompositionMetadata {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

export interface BundleResult {
  success: boolean;
  serveUrl?: string;
  compositions?: CompositionMetadata[];
  error?: string;
  cached?: boolean;
}

interface CacheEntry {
  contentHash: string;
  bundleId: string;
  bundlePath: string;
  compositions: CompositionMetadata[];
}

// Module state
const bundleCache = new Map<string, CacheEntry>();
/** Every bundle this run made, by id. `bundleCache` keeps only the newest per entry path,
 *  so a re-bundled entry's older folders are known only here (releaseBundlesUnder). */
const madeBundles = new Map<string, MadeBundle>();
let expressApp: Express | null = null;
let httpServer: Server | null = null;
let serverPort: number | null = null;
// Every bundle is served under its own path (bundle-serve-paths.ts); one
// express.static per bundle, made on its first request.
const staticHandlers = new Map<string, RequestHandler>();

// Paths
function getBundleCacheDir(): string {
  return path.join(app.getPath('userData'), 'bundle-cache');
}

function serverOrigin(port: number): string {
  return `http://127.0.0.1:${port}`;
}

// Hash file content for cache invalidation
async function getFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return createHash('md5').update(content).digest('hex');
}

// Initialize Express server
async function ensureServer(): Promise<number> {
  if (serverPort !== null && httpServer !== null) {
    return serverPort;
  }

  return new Promise((resolve, reject) => {
    expressApp = express();

    // Google Fonts proxy + on-disk cache. Mounted on the bundle server so
    // headless render Chromium fetches fonts from the same origin it loads
    // the bundle from — no cross-origin/CSP/offline foot-guns.
    registerFontProxy(expressApp);

    // Builder assets (vN.assets/, a run's work/assets/): only registered folders.
    expressApp.get(`${ASSET_ROOT_ROUTE}/:token/*`, serveAssetRoot);

    // Serve external assets (user video files) via HTTP for Remotion
    // Remotion's OffthreadVideo cannot access local files directly
    expressApp.get('/asset', (req, res) => {
      const filePath = req.query.path as string;
      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).send('Missing or invalid path parameter');
      }

      // The same allowlist as the preview's route (asset-route-extensions.ts).
      const ext = path.extname(filePath).toLowerCase();
      if (!ASSET_ROUTE_EXTENSIONS.has(ext)) {
        return res.status(400).send('Invalid file type');
      }

      // Check file exists
      if (!fsSync.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }

      res.sendFile(path.resolve(filePath));
    });

    // Each bundle at `/bundles/<bundleId>`: the folder is found by id inside
    // the cache dir (never from a client path) and only ids of the current
    // layout version are served, so a pre-change bundle (publicPath `/`)
    // can never be loaded from under a sub-path.
    expressApp.use(`${BUNDLE_ROUTE}/:bundleId`, (req, res, next) => {
      const bundleId = req.params.bundleId;
      if (!isBundleId(bundleId)) {
        res.status(404).send('Unknown bundle');
        return;
      }
      let handler = staticHandlers.get(bundleId);
      if (!handler) {
        const bundleDir = path.join(getBundleCacheDir(), bundleId);
        if (!fsSync.existsSync(path.join(bundleDir, 'index.html'))) {
          res.status(404).send('Unknown bundle');
          return;
        }
        handler = express.static(bundleDir);
        staticHandlers.set(bundleId, handler);
      }
      handler(req, res, next);
    });

    // Find available port starting from 3100
    const tryPort = (port: number): void => {
      httpServer = expressApp!.listen(port, '127.0.0.1', () => {
        serverPort = port;
        log.info(`Bundle server running on port ${port}`);
        resolve(port);
      });

      httpServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          httpServer = null;
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    };

    tryPort(3100);
  });
}

/**
 * Start (or reuse) the local asset server and return its base URL. Studio's
 * export entry embeds `/asset?path=` URLs at generation time, i.e. before any
 * bundling has happened, so it needs the port up front rather than guessing it.
 */
export async function ensureAssetServerUrl(): Promise<string> {
  return serverOrigin(await ensureServer());
}

export interface BundleOptions {
  onProgress?: (percent: number) => void;
  skipWrapper?: boolean;
  toneAudioPath?: string;
  /** Abort kills the webpack worker (the TSX builder's cancel and caps). */
  signal?: AbortSignal;
}

/**
 * Run the webpack compile in a utility process (bundle-worker.ts). In the main
 * process it blocked the event loop for seconds — every window froze from the
 * moment a render started until the bundle finished — and it can't move to a
 * worker thread because bundle() calls process.chdir.
 */
function bundleInWorker(
  request: BundleWorkerRequest,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Bundling cancelled'));
      return;
    }
    const worker = utilityProcess.fork(path.join(__dirname, 'bundle-worker.js'), [], {
      serviceName: 'vidtsx-bundle-worker',
    });
    let settled = false;
    const onAbort = (): void => settle(() => reject(new Error('Bundling cancelled')));
    const settle = (outcome: () => void): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      outcome();
      worker.kill();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    worker.on('message', (msg: BundleWorkerReply) => {
      if (msg.type === 'progress') onProgress?.(msg.percent);
      else if (msg.type === 'done') settle(() => resolve(msg.bundlePath));
      else settle(() => reject(new Error(msg.message)));
    });
    worker.on('exit', (code) => {
      // Crash before a reply (OOM, missing module) — surface it instead of hanging.
      if (!settled) {
        settled = true;
        signal?.removeEventListener('abort', onAbort);
        reject(new Error(`Bundle worker exited before finishing (code ${code})`));
      }
    });
    worker.once('spawn', () => {
      if (!settled) worker.postMessage(request);
    });
  });
}

// Main bundle function
export async function bundleComposition(
  entryFilePath: string,
  options?: BundleOptions
): Promise<BundleResult> {
  try {
    // Validate file exists
    await fs.access(entryFilePath);

    // Calculate content hash for caching
    const contentHash = await getFileHash(entryFilePath);

    // Check cache (skip if tone audio needs injection — wrapper must be regenerated).
    // A cached bundle keeps its own path; one whose folder is gone is rebuilt.
    const cached = bundleCache.get(entryFilePath);
    if (
      cached &&
      cached.contentHash === contentHash &&
      !options?.toneAudioPath &&
      fsSync.existsSync(path.join(cached.bundlePath, 'index.html'))
    ) {
      // "Used": the start-up prune reads the folder's mtime (bundle-cache-prune.ts).
      const now = new Date();
      void fs.utimes(cached.bundlePath, now, now).catch(() => {});
      const port = await ensureServer();
      return {
        success: true,
        serveUrl: bundleServeUrl(serverOrigin(port), cached.bundleId),
        compositions: cached.compositions,
        cached: true,
      };
    }

    // Ensure bundle directory exists
    const bundleCacheDir = getBundleCacheDir();
    await fs.mkdir(bundleCacheDir, { recursive: true });

    // Its own folder and URL path; the bundle is built FOR that path (publicPath).
    const bundleId = makeBundleId(contentHash);
    const outDir = path.join(bundleCacheDir, bundleId);
    const publicPath = bundlePublicPath(bundleId);

    // Ensure server is ready early (needed for tone audio URL construction)
    const port = await ensureServer();
    const origin = serverOrigin(port);

    // `staticFile('<absolute path>')` plays in the preview (virtual module)
    // but the real Remotion refuses it at render — rewrite those literals to
    // this server's `/asset?path=` urls in a sibling entry (W8 Stage 6).
    const renderEntry = await materializeAbsoluteStaticFiles(entryFilePath, origin);

    // For files that already have registerRoot() (like caption entries), skip wrapper
    // For user TSX files that are just components, generate a wrapper
    let entryPoint = renderEntry;
    let wrapperPath: string | null = null;

    if (!options?.skipWrapper) {
      // Construct tone audio URL if extraction was done
      let toneAudioUrl: string | undefined;
      if (options?.toneAudioPath) {
        toneAudioUrl = `${origin}/asset?path=${encodeURIComponent(options.toneAudioPath)}`;
      }

      // Generate wrapper that calls registerRoot()
      // User TSX files are React components that don't have registerRoot
      // The wrapper imports their component and registers it properly
      const wrapper = await generateWrapper(renderEntry, {
        toneAudioUrl,
        fontProxyBaseUrl: origin,
      });
      wrapperPath = wrapper.wrapperPath;
      entryPoint = wrapperPath;
    }

    // Bundle the composition using the entry point
    let bundlePath: string;
    try {
      bundlePath = await bundleInWorker(
        {
          entryPoint,
          outDir,
          // rootDir must be a real OS directory — webpack chdirs into it, and
          // chdir does NOT go through Electron's asar shim. getAppRoot()
          // returns <install>/resources/ in packaged, project root in dev.
          rootDir: getAppRoot(),
          appPath: app.getAppPath(),
          publicPath,
        },
        options?.onProgress,
        options?.signal,
      );
    } catch (bundleError) {
      // Cancelled: no CLI fallback, and no half-written bundle left behind.
      if (options?.signal?.aborted) {
        if (wrapperPath) await cleanupWrapper(wrapperPath);
        await fs.rm(outDir, { recursive: true, force: true }).catch(() => {});
        throw bundleError;
      }
      log.error('Programmatic bundling failed', {
        error: bundleError instanceof Error ? bundleError.message : String(bundleError),
        stack: bundleError instanceof Error ? bundleError.stack : undefined,
        cause: bundleError instanceof Error ? (bundleError as Error & { cause?: unknown }).cause : undefined,
      });
      // CLI fallback can't work in packaged builds — npx and a `remotion` binary
      // aren't reliably on user PATH, and node_modules sits inside app.asar.
      // Re-throw so the real error surfaces to the UI instead of being masked by
      // a misleading "npm error could not determine executable to run".
      if (app.isPackaged) {
        throw bundleError;
      }
      bundlePath = await bundleWithCLI(entryPoint, outDir, publicPath);
    }

    // Clean up wrapper file after bundling completes (only if we created one)
    if (wrapperPath) {
      await cleanupWrapper(wrapperPath);
    }

    // Get composition metadata from the bundle at its own URL
    const serveUrl = bundleServeUrl(origin, bundleId);
    let compositions: CompositionMetadata[];

    try {
      log.debug('Getting compositions', { serveUrl });
      compositions = await listBundleCompositions(serveUrl);
      log.debug('Found compositions', { ids: compositions.map((c) => c.id) });
    } catch (compError) {
      // If getCompositions fails, return empty array but still allow preview
      log.warn('Failed to get compositions', { error: compError instanceof Error ? compError.message : String(compError) });
      compositions = [];
    }

    // Update cache
    madeBundles.set(bundleId, { entryFilePath, bundlePath });
    bundleCache.set(entryFilePath, {
      contentHash,
      bundleId,
      bundlePath,
      compositions,
    });

    return {
      success: true,
      serveUrl,
      compositions,
      cached: false,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown bundling error';
    if (options?.signal?.aborted) log.info('Bundle cancelled');
    else log.error('Bundle error', error);
    return {
      success: false,
      error: formatBundleError(error),
    };
  }
}

// CLI fallback for Windows path issues
async function bundleWithCLI(entryFilePath: string, outDir: string, publicPath: string): Promise<string> {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const args = ['remotion', 'bundle', entryFilePath, '--out-dir', outDir, '--public-path', publicPath, '--bundle-cache=false'];
    const proc = spawn('npx', args, {
      cwd: getAppRoot(),
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(outDir);
      } else {
        reject(new Error(`Bundle CLI failed (exit ${code}): ${stderr || stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to start bundle CLI: ${err.message}`));
    });
  });
}

// Format error messages for user display
function formatBundleError(error: string): string {
  // Extract missing module name from Webpack errors
  // Match "Can't resolve 'package-name'" — must skip the apostrophe in "Can't"
  const missingModuleMatch = error.match(/Can't resolve ['"]([^'"]+)['"]/);
  if (missingModuleMatch) {
    const pkg = missingModuleMatch[1];
    return `Missing package: ${pkg}. This package works in preview (via CDN) but is not installed for rendering.`;
  }

  // Syntax error formatting
  if (error.includes('SyntaxError') || error.includes('Unexpected token')) {
    return `Syntax error in TSX file: ${error.split('\n')[0]}`;
  }

  // Generic error — keep enough context to diagnose webpack/esbuild stack traces.
  return error.length > 2000 ? error.slice(0, 2000) + '...' : error;
}

// Clear cache entry
export function invalidateCache(filePath: string): void {
  bundleCache.delete(filePath);
}

// Clear all cache
export function clearAllCache(): void {
  bundleCache.clear();
}

/**
 * Delete every bundle made from an entry inside `dir` (a builder run's folder:
 * its looks' bundles serve nothing once the run is over). Returns how many.
 */
export async function releaseBundlesUnder(dir: string): Promise<number> {
  const ids = bundlesMadeInside(madeBundles, dir);
  for (const [entryFilePath, entry] of [...bundleCache]) {
    if (ids.includes(entry.bundleId)) bundleCache.delete(entryFilePath);
  }
  for (const id of ids) {
    const made = madeBundles.get(id)!;
    madeBundles.delete(id);
    staticHandlers.delete(id);
    await fs.rm(made.bundlePath, { recursive: true, force: true }).catch(() => {});
  }
  return ids.length;
}

/**
 * The start-up prune: bundle folders unused for 7 days, except those this run
 * already made and those `keepUrls` (saved render-queue jobs) point at.
 */
export async function pruneStaleBundles(keepUrls: readonly string[]): Promise<string[]> {
  const keep = new Set<string>(madeBundles.keys());
  for (const url of keepUrls) {
    const id = bundleIdFromUrl(url);
    if (id) keep.add(id);
  }
  return pruneBundleFolders(getBundleCacheDir(), { keep });
}

// Cleanup on app quit
export function cleanup(): void {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  expressApp = null;
  serverPort = null;
  staticHandlers.clear();
}

// Get the current bundler server port (for asset serving)
export function getBundlerPort(): number | null {
  return serverPort;
}
