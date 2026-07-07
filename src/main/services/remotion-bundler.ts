import { logEngine } from '../../logging/log-engine';
import { bundle } from '@remotion/bundler';
import { getCompositions } from '@remotion/renderer';

const log = logEngine.createLogger('Bundler');
import { createHash } from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import express from 'express';
import type { Express } from 'express';
import type { Server } from 'http';
import { app } from 'electron';
import { generateWrapper, cleanupWrapper } from './composition-wrapper';
import { registerFontProxy } from './font-proxy';
import { getRemotionBinariesDir } from '../utils/paths';
import { getAppRoot } from '../utils/paths';

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
  bundlePath: string;
  compositions: CompositionMetadata[];
}

// Module state
const bundleCache = new Map<string, CacheEntry>();
let expressApp: Express | null = null;
let httpServer: Server | null = null;
let serverPort: number | null = null;
let currentBundlePath: string | null = null;

// Paths
function getBundleCacheDir(): string {
  return path.join(app.getPath('userData'), 'bundle-cache');
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

    // Serve external assets (user video files) via HTTP for Remotion
    // Remotion's OffthreadVideo cannot access local files directly
    expressApp.get('/asset', (req, res) => {
      const filePath = req.query.path as string;
      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).send('Missing or invalid path parameter');
      }

      // Whitelist asset extensions allowed through this endpoint. Kept as an explicit
      // allowlist (never wildcard) so executables and scripts can never be served even
      // if a malformed user TSX builds a path. Covers the asset library's full surface:
      // video / audio / images / 3D / fonts / data.
      const ext = path.extname(filePath).toLowerCase();
      const allowedExtensions = [
        // video
        '.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v',
        // audio
        '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac',
        // images
        '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif',
        // 3D
        '.glb', '.gltf', '.obj', '.fbx',
        // fonts
        '.woff', '.woff2', '.ttf', '.otf',
        // data
        '.json', '.txt', '.csv', '.xml', '.md',
      ];
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).send('Invalid file type');
      }

      // Check file exists
      if (!fsSync.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }

      res.sendFile(path.resolve(filePath));
    });

    // Serve static files from the current bundle path
    expressApp.use((req, res, next) => {
      if (currentBundlePath) {
        express.static(currentBundlePath)(req, res, next);
      } else {
        res.status(404).send('No bundle loaded');
      }
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

// Update the bundle path being served
function updateBundlePath(bundlePath: string): void {
  currentBundlePath = bundlePath;
}

export interface BundleOptions {
  onProgress?: (percent: number) => void;
  skipWrapper?: boolean;
  toneAudioPath?: string;
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

    // Check cache (skip if tone audio needs injection — wrapper must be regenerated)
    const cached = bundleCache.get(entryFilePath);
    if (cached && cached.contentHash === contentHash && !options?.toneAudioPath) {
      const port = await ensureServer();
      updateBundlePath(cached.bundlePath);
      return {
        success: true,
        serveUrl: `http://127.0.0.1:${port}`,
        compositions: cached.compositions,
        cached: true,
      };
    }

    // Ensure bundle directory exists
    const bundleCacheDir = getBundleCacheDir();
    await fs.mkdir(bundleCacheDir, { recursive: true });

    // Generate unique output directory
    const bundleId = `bundle-${contentHash.slice(0, 8)}-${Date.now()}`;
    const outDir = path.join(bundleCacheDir, bundleId);

    // Ensure server is ready early (needed for tone audio URL construction)
    const port = await ensureServer();

    // For files that already have registerRoot() (like caption entries), skip wrapper
    // For user TSX files that are just components, generate a wrapper
    let entryPoint = entryFilePath;
    let wrapperPath: string | null = null;

    if (!options?.skipWrapper) {
      // Construct tone audio URL if extraction was done
      let toneAudioUrl: string | undefined;
      if (options?.toneAudioPath) {
        toneAudioUrl = `http://127.0.0.1:${port}/asset?path=${encodeURIComponent(options.toneAudioPath)}`;
      }

      // Generate wrapper that calls registerRoot()
      // User TSX files are React components that don't have registerRoot
      // The wrapper imports their component and registers it properly
      const wrapper = await generateWrapper(entryFilePath, {
        toneAudioUrl,
        fontProxyBaseUrl: `http://127.0.0.1:${port}`,
      });
      wrapperPath = wrapper.wrapperPath;
      entryPoint = wrapperPath;
    }

    // Bundle the composition using the entry point
    let bundlePath: string;
    try {
      const appRoot = getAppRoot();
      bundlePath = await bundle({
        entryPoint,
        outDir,
        // rootDir must be a real OS directory — webpack chdirs into it, and
        // chdir does NOT go through Electron's asar shim. getAppRoot() returns
        // <install>/resources/ in packaged, project root in dev — both real.
        rootDir: appRoot,
        webpackOverride: (config) => {
          config.resolve = config.resolve || {};
          config.resolve.modules = [
            ...(config.resolve.modules || ['node_modules']),
            // node_modules live inside app.asar in packaged builds; Electron's
            // asar shim makes them readable via fs/enhanced-resolve. We can NOT
            // use this path as rootDir (chdir doesn't go through the shim).
            path.join(app.getAppPath(), 'node_modules'),
          ];
          // App-source path aliases, mirroring electron.vite.config — let
          // generated render entries resolve app `@shared/...`/`@features/...`
          // imports. Harmless for Creator user-TSX bundling — user code never
          // uses these prefixes, so nothing else resolves differently. Base is
          // app.getAppPath() (project root in dev; asar root packaged).
          config.resolve.alias = {
            ...(config.resolve.alias || {}),
            '@shared': path.join(app.getAppPath(), 'src', 'shared'),
            '@features': path.join(app.getAppPath(), 'src', 'features'),
            '@renderer': path.join(app.getAppPath(), 'src', 'renderer'),
          };
          return config;
        },
        onProgress: (percent) => {
          if (options?.onProgress) {
            options.onProgress(percent);
          }
        },
      });
    } catch (bundleError) {
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
      bundlePath = await bundleWithCLI(entryPoint, outDir);
    }

    // Clean up wrapper file after bundling completes (only if we created one)
    if (wrapperPath) {
      await cleanupWrapper(wrapperPath);
    }

    // Update bundle path (server already started above)
    updateBundlePath(bundlePath);

    // Get composition metadata
    const serveUrl = `http://127.0.0.1:${port}`;
    let compositions: CompositionMetadata[];

    try {
      log.debug('Getting compositions', { serveUrl });
      const remotionCompositions = await getCompositions(serveUrl, {
        timeoutInMilliseconds: 30000,
        binariesDirectory: getRemotionBinariesDir() ?? undefined,
      });

      log.debug('Found compositions', { ids: remotionCompositions.map((c) => c.id) });

      compositions = remotionCompositions.map((comp) => ({
        id: comp.id,
        width: comp.width,
        height: comp.height,
        fps: comp.fps,
        durationInFrames: comp.durationInFrames,
      }));
    } catch (compError) {
      // If getCompositions fails, return empty array but still allow preview
      log.warn('Failed to get compositions', { error: compError instanceof Error ? compError.message : String(compError) });
      compositions = [];
    }

    // Update cache
    bundleCache.set(entryFilePath, {
      contentHash,
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
    log.error('Bundle error', error);
    return {
      success: false,
      error: formatBundleError(error),
    };
  }
}

// CLI fallback for Windows path issues
async function bundleWithCLI(entryFilePath: string, outDir: string): Promise<string> {
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const args = ['remotion', 'bundle', entryFilePath, '--out-dir', outDir];
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

// Cleanup on app quit
export function cleanup(): void {
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
  expressApp = null;
  serverPort = null;
  currentBundlePath = null;
}

// Get the current bundler server port (for asset serving)
export function getBundlerPort(): number | null {
  return serverPort;
}
